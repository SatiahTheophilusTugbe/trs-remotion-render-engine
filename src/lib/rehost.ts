import { lookup } from 'node:dns/promises';
import { imageDimensions, type ImageDims } from './imageDims.js';

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

/**
 * Identifies an image type from its real byte signature, ignoring any declared Content-Type.
 * A real-world host (confirmed: Telegram's file server) can serve a genuine image under a
 * generic/missing Content-Type (e.g. application/octet-stream) -- trusting the header alone then
 * wrongly rejects a real photo. Same "sniff real bytes, don't trust a declared type" fix already
 * applied once in this project for the identical class of bug (13a's Build Vision Request).
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export const withinSizeCap = (bytes: number): boolean => bytes > 0 && bytes <= MAX_PHOTO_BYTES;

// slot names a visual inside the beat ("1", "1b" for a split's second image); absent for photo_url.
export const objectKey = (renderId: string, position: number, ext: string, slot?: string): string =>
  `assets/${renderId}/${position}${slot === undefined ? '' : '-' + slot}.${ext}`;

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
export type RehostBeat = { photo_url?: string | null; beat_index: number; photo_w?: number; photo_h?: number };
export type RehostResult<T> = { ok: true; beats: T[]; warnings: string[] } | { ok: false; errors: string[] };
export type ResolveFn = (hostname: string) => Promise<string[]>;

type FetchOutcome = { ok: true; url: string; dims: ImageDims | null } | { ok: false; error: string };

/** Thrown internally to carry a short, URL-free failure reason. Exported so other server-side
 *  fetch-and-cap call sites (e.g. api/rehost-telegram-file.ts) can reuse readCapped's error shape
 *  without duplicating the streaming-cap logic. */
export class RehostFailure extends Error {
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

export async function guardedFetch(
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

/** Reads the body, aborting as soon as the cap is exceeded (a missing/lying content-length cannot bypass it).
 *  Exported for reuse by other endpoints that need the same streaming size cap against MAX_PHOTO_BYTES
 *  without an SSRF guard (e.g. a fixed, trusted host like api.telegram.org). */
export async function readCapped(res: Response): Promise<Uint8Array> {
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
  keyFor: (ext: string) => string,
  errorFor: (host: string, reason: string | number) => string,
  deps: { fetchFn: typeof fetch; put: PutObjectFn; resolve: ResolveFn },
  timeoutMs: number,
): Promise<FetchOutcome> {
  const host = hostOf(url);
  const fail = (reason: string | number): FetchOutcome => ({ ok: false, error: errorFor(host, reason) });
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
    const headerType = allowedImageType(res.headers.get('content-type'));
    bytes = await readCapped(res);
    mime = headerType ?? sniffImageType(bytes) ?? '';
    if (!mime) return fail('unsupported_content_type');
  } catch (err) {
    if (err instanceof RehostFailure) return fail(err.reason);
    const name = err instanceof Error ? err.name : '';
    return fail(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network_error');
  }
  const key = keyFor(extForContentType(mime)!);
  try {
    await deps.put({ key, body: bytes, contentType: mime });
  } catch {
    return fail('upload_failed');
  }
  return { ok: true, url: publicUrl(key), dims: imageDimensions(bytes) };
}

/**
 * Re-hosts every beat's photo and visual. Never falls back to an original URL. An image that cannot be
 * fetched no longer stops the render (owner 2026-10-18: no stopping because of an image): a failed visual is
 * dropped (a split keeps its other half), a failed beat photo takes the beat's first surviving visual, else the
 * nearest beat's re-hosted photo (with that photo's credit and subject box). Each failure is reported in
 * `warnings`. Only when no photo at all could be re-hosted does it fail with every error. A global deadline
 * (budgetMs) makes the remaining photos fail fast with reason `timeout` so the function never outlives its
 * time limit.
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
  const out: T[] = beats.map((b) => {
    const c = { ...b } as T & { visuals?: unknown };
    const vs = (b as { visuals?: unknown }).visuals;
    if (Array.isArray(vs)) c.visuals = vs.map((v) => ({ ...(v as object) }));
    return c;
  });
  const resolve = deps.resolve ?? defaultResolve;
  const deadline = Date.now() + (deps.budgetMs ?? GLOBAL_BUDGET_MS);

  // Each beat's photo_url is its own job (unchanged behaviour). A visual url / url_b joins any existing
  // job for the same URL, so a visual repeating its beat's photo_url is fetched once.
  type Use = { apply: (url: string, dims: ImageDims | null) => void; slot?: string; position: number; beatIndex: number; label: string };
  const entries: [string, Use[]][] = [];
  const byUrl = new Map<string, Use[]>();
  const addUse = (url: unknown, use: Use, share: boolean) => {
    if (typeof url !== 'string' || url === '') return;
    const existing = share ? byUrl.get(url) : undefined;
    if (existing) {
      existing.push(use);
      return;
    }
    const list = [use];
    entries.push([url, list]);
    if (!byUrl.has(url)) byUrl.set(url, list);
  };
  out.forEach((b, i) => {
    addUse(b.photo_url, {
      position: i, beatIndex: b.beat_index, label: '',
      apply: (url, dims) => {
        b.photo_url = url;
        // The shot engine needs each photo's aspect ratio to keep a cropped subject on screen.
        if (dims) {
          b.photo_w = dims.width;
          b.photo_h = dims.height;
        }
      },
    }, false);
    const vs = (b as { visuals?: Record<string, unknown>[] }).visuals;
    (vs ?? []).forEach((v, j) => {
      for (const sfx of ['', '_b'] as const) {
        addUse(v['url' + sfx], {
          position: i, beatIndex: b.beat_index, slot: `${j}${sfx ? 'b' : ''}`, label: `visuals[${j}].url${sfx}`,
          apply: (url, dims) => {
            v['url' + sfx] = url;
            if (dims) {
              v['photo_w' + sfx] = dims.width;
              v['photo_h' + sfx] = dims.height;
            }
          },
        }, true);
      }
    });
  });

  const errors: string[] = [];
  const hosted = new Set<string>();
  let next = 0;
  const worker = async () => {
    for (;;) {
      const k = next++;
      if (k >= entries.length) return;
      const [url, uses] = entries[k];
      const first = uses[0];
      const r = await rehostOne(
        url,
        (ext) => objectKey(renderId, first.position, ext, first.slot),
        (host, reason) =>
          first.label
            ? `beat ${first.beatIndex} (position ${first.position}): ${first.label} could not be fetched (host=${host}, status=${reason})`
            : formatPhotoError(first.beatIndex, first.position, host, reason),
        { fetchFn: deps.fetchFn, put: deps.put, resolve },
        Math.min(FETCH_TIMEOUT_MS, deadline - Date.now()),
      );
      if (r.ok) {
        uses.forEach((u) => u.apply(r.url, r.dims));
        hosted.add(r.url);
      } else errors.push(r.error);
    }
  };
  const n = Math.max(1, Math.min(deps.concurrency ?? REHOST_CONCURRENCY, entries.length));
  await Promise.all(Array.from({ length: n }, worker));
  if (!errors.length) return { ok: true, beats: out, warnings: [] };
  return repairFailures(out, hosted, errors);
}

type Visual = Record<string, unknown>;
const B_FIELDS = ['url', 'focal', 'credit', 'photo_w', 'photo_h'] as const;

// Keeps only re-hosted images. A split whose one half failed becomes a single of the other half.
const repairVisuals = (vs: Visual[], hosted: Set<string>): Visual[] => {
  const kept: Visual[] = [];
  for (const v of vs) {
    const okA = typeof v.url === 'string' && hosted.has(v.url);
    const okB = typeof v.url_b === 'string' && hosted.has(v.url_b);
    const single = { ...v, layout: 'single' } as Visual;
    for (const f of B_FIELDS) delete single[f + '_b'];
    if (okA && (okB || v.layout !== 'split')) kept.push(v);
    else if (okA) kept.push(single);
    else if (okB) {
      for (const f of B_FIELDS) {
        if (v[f + '_b'] !== undefined) single[f] = v[f + '_b'];
        else delete single[f];
      }
      kept.push(single);
    }
  }
  if (kept.length) kept[0] = { ...kept[0], at_sec: 0 };
  return kept;
};

function repairFailures<T extends RehostBeat>(beats: T[], hosted: Set<string>, errors: string[]): RehostResult<T> {
  type Meta = RehostBeat & { visuals?: Visual[]; photo_credit?: unknown; focal?: unknown };
  const bs = beats as (T & Meta)[];
  const okPhoto = (b: Meta) => typeof b.photo_url === 'string' && hosted.has(b.photo_url);
  const donors = bs.map((b) => (okPhoto(b) ? { ...b } : null));
  for (const b of bs) {
    if (Array.isArray(b.visuals)) {
      const vs = repairVisuals(b.visuals, hosted);
      if (vs.length) b.visuals = vs;
      else delete b.visuals;
    }
  }
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (okPhoto(b)) continue;
    const v = b.visuals?.[0];
    if (v && typeof v.url === 'string') {
      b.photo_url = v.url;
      b.photo_credit = v.credit;
      b.focal = v.focal;
      b.photo_w = v.photo_w as number | undefined;
      b.photo_h = v.photo_h as number | undefined;
      continue;
    }
    let donor: Meta | null = null;
    for (let d = 1; d < bs.length && !donor; d++) donor = donors[i - d] ?? donors[i + d] ?? null;
    if (!donor) return { ok: false, errors };
    b.photo_url = donor.photo_url;
    b.photo_credit = donor.photo_credit;
    b.focal = donor.focal;
    b.photo_w = donor.photo_w;
    b.photo_h = donor.photo_h;
  }
  return { ok: true, beats: bs, warnings: errors };
}
