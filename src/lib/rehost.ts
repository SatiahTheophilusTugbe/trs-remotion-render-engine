// Server-side photo re-hosting: fetch each beat photo with a browser UA and re-upload it to the
// Remotion S3 bucket, because some CDNs (e.g. cdn.nba.com) refuse Lambda/headless-Chromium fetches.
// Everything here is pure or takes injected dependencies so it is unit-testable without network/S3.

export const REHOST_BUCKET = 'remotionlambda-useast1-riu6td7irs';
export const REHOST_REGION = 'us-east-1';
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 10_000;
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

type FetchOutcome = { ok: true; url: string } | { ok: false; error: string };

async function rehostOne(
  url: string,
  beatIndex: number,
  position: number,
  renderId: string,
  fetchFn: typeof fetch,
  put: PutObjectFn,
): Promise<FetchOutcome> {
  const host = hostOf(url);
  const fail = (reason: string | number): FetchOutcome => ({
    ok: false,
    error: formatPhotoError(beatIndex, position, host, reason),
  });
  let bytes: Uint8Array;
  let mime: string;
  try {
    const res = await fetchFn(url, {
      headers: { 'User-Agent': BROWSER_USER_AGENT, Accept: IMAGE_ACCEPT },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return fail(res.status);
    const type = allowedImageType(res.headers.get('content-type'));
    if (!type) return fail('unsupported_content_type');
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_PHOTO_BYTES) return fail('too_large');
    bytes = new Uint8Array(await res.arrayBuffer());
    if (!withinSizeCap(bytes.length)) return fail(bytes.length === 0 ? 'empty_body' : 'too_large');
    mime = type;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    return fail(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network_error');
  }
  const key = objectKey(renderId, position, extForContentType(mime)!);
  try {
    await put({ key, body: bytes, contentType: mime });
  } catch {
    return fail('upload_failed');
  }
  return { ok: true, url: publicUrl(key) };
}

/**
 * Re-hosts every beat's photo. All-or-nothing: if any photo fails, returns every failure and the
 * caller must not render (no fallback to the original URL).
 */
export async function rehostPhotos<T extends RehostBeat>(
  beats: T[],
  renderId: string,
  deps: { fetchFn: typeof fetch; put: PutObjectFn; concurrency?: number },
): Promise<RehostResult<T>> {
  const out: T[] = beats.map((b) => ({ ...b }));
  const errors: (string | undefined)[] = new Array(beats.length).fill(undefined);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= beats.length) return;
      const url = beats[i].photo_url;
      if (typeof url !== 'string' || url === '') continue;
      const r = await rehostOne(url, beats[i].beat_index, i, renderId, deps.fetchFn, deps.put);
      if (r.ok) out[i].photo_url = r.url;
      else errors[i] = r.error;
    }
  };
  const n = Math.max(1, Math.min(deps.concurrency ?? REHOST_CONCURRENCY, beats.length));
  await Promise.all(Array.from({ length: n }, worker));
  const failed = errors.filter((e): e is string => e !== undefined);
  return failed.length ? { ok: false, errors: failed } : { ok: true, beats: out };
}
