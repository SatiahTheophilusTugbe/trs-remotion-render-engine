import { sniffImageType, RehostFailure } from './rehost.js';
import { imageDimensions } from './imageDims.js';

// Pasted-link uploads (2026-10-04): the owner pastes an image address in Telegram instead of
// downloading and re-uploading the file. The bytes are checked here before anything is stored.
export const MIN_SIDE = 600;
export const MAX_LINK_BYTES = 10 * 1024 * 1024;
export const LINK_TIMEOUT_MS = 15_000;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type LinkReason = 'not an image' | 'too small' | 'too large' | 'site blocked the download' | 'timed out' | 'bad link';

export function checkImage(bytes: Uint8Array):
  | { ok: true; mime: string; width: number; height: number }
  | { ok: false; reason: 'not an image' | 'too small' | 'too large' } {
  if (bytes.length > MAX_LINK_BYTES) return { ok: false, reason: 'too large' };
  const mime = sniffImageType(bytes);
  if (!mime || !ALLOWED.has(mime)) return { ok: false, reason: 'not an image' };
  const d = imageDimensions(bytes);
  if (d && Math.max(d.width, d.height) < MIN_SIDE) return { ok: false, reason: 'too small' };
  return { ok: true, mime, width: d?.width ?? 0, height: d?.height ?? 0 };
}

/** https only (http is upgraded); anything else is not a usable link. */
export function normaliseLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!/^https?:\/\/\S+$/i.test(s) || s.length > 2000) return null;
  return s.replace(/^http:\/\//i, 'https://');
}

/** Owner-facing reason for a failed fetch. Never includes the URL. */
export function linkFailureReason(err: unknown): LinkReason {
  if (err instanceof RehostFailure) {
    if (err.reason === 'blocked') return 'bad link';
    if (err.reason === 'too_large') return 'too large';
    if (err.reason === 'timeout') return 'timed out';
    return 'site blocked the download';
  }
  const name = err instanceof Error ? err.name : '';
  return name === 'TimeoutError' || name === 'AbortError' ? 'timed out' : 'site blocked the download';
}
