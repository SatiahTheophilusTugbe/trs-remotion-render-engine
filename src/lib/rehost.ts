import { lookup } from 'node:dns/promises';

// Server-side photo re-hosting: fetch each beat photo with a browser UA and re-upload it to the
// Remotion S3 bucket, because some CDNs (e.g. cdn.nba.com) refuse Lambda/headless-Chromium fetches.
// Everything here is pure or takes injected dependencies so it is unit-testable without network/S3.

export const REHOST_BUCKET = 'remotionlambda-useast1-riu6td7irs';
export const REHOST_REGION = 'us-east-1';
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 10_000;
export const GLOBAL_BUDGET_MS = 45_000;
export const MAX_REDIRECTS = 3;
export const REHOST_CONCURRENCY = 4;
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/*;q=0.8';

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Normalises a Content-Type header to an allow-listed MIME type, or null. */
export function allowedImageType(contentType: string | null | undefined): string | null {
  if (!contentType) return null;
  const base = contentType.split(';')[0].trim().toLowerCase();
  return base in EXT_BY_TYPE ? base : null;
}

export const extForContentType = (mime: string): string | null => EXT_BY_TYPE[mime] ?? null;

export const withinSizeCap = (bytes: number): boolean => bytes > 0 && bytes <= MAX_PHOTO_BYTES;

export const objectKey = (renderId: string, position: number, ext: string): string =>
  `assets/${renderId}/${position}.${ext}`;

export const publicUrl = (key: string): string =>
  `https://s3.${REHOST_REGION}.amazonaws.com/${REHOST_BUCKET}/${key}`;

/** Hostname only: never the path, query or userinfo (production URLs can embed bot tokens). */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

export const formatPhotoError = (
  beatIndex: number,
  position: number,
  host: string,
  reason: string | number,
): string =>
  `beat ${beatIndex} (position ${position}): photo could not be fetched (host=${host}, status=${reason})`;

export type PutObjectFn = (args: { key: string; body: Uint8Array; contentType: string }) => Promise<void>;
export type RehostBeat = { photo_url?: string | null; beat_index: number };
export type RehostResult<T> = { ok: true; beats: T[] } | { ok: false; errors: string[] };
export type ResolveFn = (hostname: string) => Promise<string[]>;

type FetchOutcome = { ok: true; url: string } | { ok: false; error: string };

/** Thrown internally to carry a short, URL-free failure reason. */
class RehostFailure extends Error {
  readonly reason: string | number;
  constructor(reason: string | number) {
    super(String(reason));
    this.reason = reason;
  }
}

// ---- SSRF guard -------------------------------------------------------------------------------

function parseIPv4(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((n) => n <= 255) ? o : null;
}

function isBlockedIPv4(o: number[]): boolean {
  const [a, b] = o;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) || // link-local incl. metadata 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** Parses an IPv6 literal (no brackets, no zone) into 8 16-bit groups. */
function parseIPv6(input: string): number[] | null {
  let s = input.toLowerCase();
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const o = parseIPv4(v4[1]);
    if (!o) return null;
    s = s.slice(0, -v4[1].length) + ((o[0] << 8) | o[1]).toString(16) + ':' + ((o[2] << 8) | o[3]).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] === '' ? [] : halves[0].split(':');
  const tail = halves.length === 2 && halves[1] !== '' ? halves[1].split(':') : [];
  let groups: string[];
  if (halves.length === 1) {
    groups = head;
  } else {
    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;
    groups = [...head, ...new Array<string>(fill).fill('0'), ...tail];
  }
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/** True for loopback/private/link-local/metadata/unspecified addresses (v4, v6, v4-mapped v6). */
export function isBlockedIp(ip: string): boolean {
  const host = ip.replace(/^\[|\]$/g, '').split('%')[0];
  const v4 = parseIPv4(host);
  if (v4) return isBlockedIPv4(v4);
  const g = parseIPv6(host);
  if (!g) return true; // unparseable: fail closed
  const embeddedV4 = [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255];
  if (g.slice(0, 5).every((x) => x === 0)) {
    if (g[5] === 0xffff) return isBlockedIPv4(embeddedV4); // ::ffff:a.b.c.d (v4-mapped)
    if (g[5] === 0) return g[6] === 0 && g[7] <= 1 ? true : isBlockedIPv4(embeddedV4); // ::, ::1, ::a.b.c.d
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isBlockedIPv4(embeddedV4); // NAT64
  return false;
}

const stripBrackets = (h: string): string => h.replace(/^\[|\]$/g, '');
const isIpLiteral = (host: string): boolean => host.includes(':') || parseIPv4(host) !== null;

export function isBlockedHostname(hostname: string): boolean {
  const h = stripBrackets(hostname.toLowerCase().replace(/\.$/, ''));
  if (h === '' || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) {
    return true;
  }
  return isIpLiteral(h) ? isBlockedIp(h) : false;
}

/** Returns the parsed URL if it is https and not an obviously internal target; throws otherwise. */
export function assertSafeUrl(u: string | URL): URL {
  let url: URL;
  try {
    url = typeof u === 'string' ? new URL(u) : u;
  } catch {
    throw new RehostFailure('blocked');
  }
  if (url.protocol !== 'https:' || isBlockedHostname(url.hostname)) throw new RehostFailure('blocked');
  return url;
}

export const defaultResolve: ResolveFn = async (hostname) =>
  (await lookup(hostname, { all: true })).map((r) => r.address);

// NOTE: DNS is resolved and vetted here, then fetch() resolves the name again itself, so a hostile DNS
// server could still rebind between the two (small TOCTOU window). Accepted: it needs an
// attacker-controlled hostname, and the only data that leaves is re-uploaded bytes that must pass the
// image content-type and size checks.
async function assertResolvesPublic(hostname: string, resolve: ResolveFn): Promise<void> {
  const h = stripBrackets(hostname);
  if (isIpLiteral(h)) return; // literal already vetted by assertSafeUrl
  let addrs: string[];
  try {
    addrs = await resolve(h);
  } catch {
    throw new RehostFailure('network_error');
  }
  if (addrs.length === 0 || addrs.some(isBlockedIp)) throw new RehostFailure('blocked');
}

async function guardedFetch(
  startUrl: string,
  fetchFn: typeof fetch,
  resolve: ResolveFn,
  signal: AbortSignal,
): Promise<Response> {
  let url = assertSafeUrl(startUrl);
  for (let hop = 0; ; hop++) {
    await assertResolvesPublic(url.hostname, resolve);
    const res = await fetchFn(url.toString(), {
      headers: { 'User-Agent': BROWSER_USER_AGENT, Accept: IMAGE_ACCEPT },
      redirect: 'manual',
      signal,
    });
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get('location');
    await res.body?.cancel().catch(() => {});
    if (!location) throw new RehostFailure(res.status);
    if (hop >= MAX_REDIRECTS) throw new RehostFailure('too_many_redirects');
    try {
      url = assertSafeUrl(new URL(location, url));
    } catch {
      throw new RehostFailure('blocked');
    }
  }
}

/** Reads the body, aborting as soon as the cap is exceeded (a missing/lying content-length cannot bypass it). */
async function readCapped(res: Response): Promise<Uint8Array> {
  const header = res.headers.get('content-length');
  if (header !== null && Number(header) > MAX_PHOTO_BYTES) {
    await res.body?.cancel().catch(() => {});
    throw new RehostFailure('too_large');
  }
  if (!res.body) throw new RehostFailure('empty_body');
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_PHOTO_BYTES) {
      await reader.cancel().catch(() => {});
      throw new RehostFailure('too_large');
    }
    chunks.push(value);
  }
  if (total === 0) throw new RehostFailure('empty_body');
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

async function rehostOne(
  url: string,
  beatIndex: number,
  position: number,
  renderId: string,
  deps: { fetchFn: typeof fetch; put: PutObjectFn; resolve: ResolveFn },
  timeoutMs: number,
): Promise<FetchOutcome> {
  const host = hostOf(url);
  const fail = (reason: string | number): FetchOutcome => ({
    ok: false,
    error: formatPhotoError(beatIndex, position, host, reason),
  });
  if (timeoutMs <= 0) return fail('timeout');
  let bytes: Uint8Array;
  let mime: string;
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    const res = await guardedFetch(url, deps.fetchFn, deps.resolve, signal);
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return fail(res.status);
    }
    const type = allowedImageType(res.headers.get('content-type'));
    if (!type) {
      await res.body?.cancel().catch(() => {});
      return fail('unsupported_content_type');
    }
    bytes = await readCapped(res);
    mime = type;
  } catch (err) {
    if (err instanceof RehostFailure) return fail(err.reason);
    const name = err instanceof Error ? err.name : '';
    return fail(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network_error');
  }
  const key = objectKey(renderId, position, extForContentType(mime)!);
  try {
    await deps.put({ key, body: bytes, contentType: mime });
  } catch {
    return fail('upload_failed');
  }
  return { ok: true, url: publicUrl(key) };
}

/**
 * Re-hosts every beat's photo. All-or-nothing: if any photo fails, returns every failure and the
 * caller must not render (no fallback to the original URL). A global deadline (budgetMs) makes the
 * remaining photos fail fast with reason `timeout` so the function never outlives its time limit.
 */
export async function rehostPhotos<T extends RehostBeat>(
  beats: T[],
  renderId: string,
  deps: {
    fetchFn: typeof fetch;
    put: PutObjectFn;
    concurrency?: number;
    resolve?: ResolveFn;
    budgetMs?: number;
  },
): Promise<RehostResult<T>> {
  const out: T[] = beats.map((b) => ({ ...b }));
  const errors: (string | undefined)[] = new Array(beats.length).fill(undefined);
  const resolve = deps.resolve ?? defaultResolve;
  const deadline = Date.now() + (deps.budgetMs ?? GLOBAL_BUDGET_MS);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= beats.length) return;
      const url = beats[i].photo_url;
      if (typeof url !== 'string' || url === '') continue;
      const r = await rehostOne(
        url,
        beats[i].beat_index,
        i,
        renderId,
        { fetchFn: deps.fetchFn, put: deps.put, resolve },
        Math.min(FETCH_TIMEOUT_MS, deadline - Date.now()),
      );
      if (r.ok) out[i].photo_url = r.url;
      else errors[i] = r.error;
    }
  };
  const n = Math.max(1, Math.min(deps.concurrency ?? REHOST_CONCURRENCY, beats.length));
  await Promise.all(Array.from({ length: n }, worker));
  const failed = errors.filter((e): e is string => e !== undefined);
  return failed.length ? { ok: false, errors: failed } : { ok: true, beats: out };
}
