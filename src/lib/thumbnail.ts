// src/lib/thumbnail.ts
import type { Focal } from '../types/beat';

// Avatar cover image (YouTube thumbnail + Instagram Reel cover). Owner, 2026-10-04: layout B
// (big lime stat) when the script has a grounded number, otherwise layout A (headline band).
export type ThumbStat = { value: string; label: string };
export type ThumbnailProps = {
  photo_url: string;
  focal?: Focal | null;
  photo_w?: number;
  photo_h?: number;
  line1: string;
  line2: string;
  stat?: ThumbStat | null;
  leagueBadge?: string | null;
};

export const LIME = '#AAFF00';
export const SAFE_TOP = 240; // Instagram's 3:4 grid crop keeps y 240..1680 of a 1080x1920 cover
export const SAFE_BOTTOM = 1680;
export const BAND_TOP = 1060;
export const BADGE_TOP = 260;

export const thumbLayout = (stat?: ThumbStat | null): 'A' | 'B' => (stat && stat.value && stat.label ? 'B' : 'A');

// Montserrat Bold caps average ~0.7em per character (measured on a real render, 2026-10-05: 0.62 wrapped
// "UNITED THREATEN COURT"); size the line to fill the width without overflow.
export const fitFontSize = (text: string, maxWidthPx: number, maxPx: number, minPx: number): number => {
  const n = Math.max(1, text.length);
  return Math.max(minPx, Math.min(maxPx, Math.floor(maxWidthPx / (n * 0.7))));
};

const words = (s: unknown, max: number): string =>
  String(s ?? '').replace(/\s+/g, ' ').trim().toUpperCase().split(' ').filter(Boolean).slice(0, max).join(' ');

const num01 = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
};

export function validateThumbnailInput(raw: unknown):
  | { ok: true; props: ThumbnailProps }
  | { ok: false; errors: string[] } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: ['body must be an object'] };
  const r = raw as Record<string, unknown>;
  const errors: string[] = [];
  const photo = typeof r.photo_url === 'string' ? r.photo_url : '';
  if (!photo.startsWith('https://') || photo.length > 2000) errors.push('photo_url must be https:// (max 2000 chars)');
  const line1 = words(r.line1, 3);
  if (!line1) errors.push('line1 is required');
  if (errors.length) return { ok: false, errors };

  let stat: ThumbStat | null = null;
  const s = r.stat as Record<string, unknown> | null | undefined;
  if (s && typeof s === 'object') {
    const value = String(s.value ?? '').trim();
    const label = words(s.label, 5);
    if (/^[\d.,%+\-$£€]+$/.test(value) && /\d/.test(value) && value.length <= 6 && label) stat = { value, label };
  }

  let focal: Focal | null = null;
  const f = r.focal as Record<string, unknown> | null | undefined;
  if (f && typeof f === 'object') {
    const x = num01(f.x), y = num01(f.y), w = num01(f.w), h = num01(f.h);
    if (x !== null && y !== null) focal = w && h ? { x, y, w, h } : { x, y };
  }

  return {
    ok: true,
    props: {
      photo_url: photo,
      focal,
      line1,
      line2: words(r.line2, 3),
      stat,
      leagueBadge: typeof r.leagueBadge === 'string' && r.leagueBadge.trim() ? r.leagueBadge.trim().slice(0, 20) : null,
    },
  };
}
