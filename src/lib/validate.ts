import type { Beat } from '../types/beat.js';
import { formatStat } from './stat.js';

export type NormalizedProps = {
  fps: number;
  beats: Beat[];
  leagueBadge?: string | null;
  musicUrl?: string | null;
  transitions?: boolean;
};

export type ValidationResult =
  | { ok: true; inputProps: NormalizedProps; warnings: string[] }
  | { ok: false; errors: string[] };

const MAX_BEATS = 40;
const MIN_BEAT_SEC = 0.5;
const MAX_BEAT_SEC = 60;
const MAX_TOTAL_SEC = 180;
const REQUIRED_FPS = 30;
const MAX_URL_LEN = 2000;
const MAX_OVERLAY = 80;
const MAX_LABEL = 40;
const MAX_AFFIX = 3;
const MAX_STAT_CHARS = 7;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isHttps = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith('https://') && v.length > 'https://'.length;
// n8n often stringifies numbers: accept numeric strings, return NaN for anything else.
const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
};
const clamp = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1) + '…' : s);

export function validateRenderInput(inputProps: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObj(inputProps)) return { ok: false, errors: ['inputProps must be an object'] };

  if (inputProps.fps !== undefined && inputProps.fps !== REQUIRED_FPS) {
    errors.push(`fps must be ${REQUIRED_FPS} (deployed site constraint)`);
  }
  if (inputProps.musicUrl !== undefined && inputProps.musicUrl !== null && !isHttps(inputProps.musicUrl)) {
    errors.push('musicUrl must be an https:// URL when provided');
  }

  const rawBeats = inputProps.beats;
  if (!Array.isArray(rawBeats) || rawBeats.length === 0) {
    errors.push('beats must be a non-empty array');
    return { ok: false, errors };
  }
  if (rawBeats.length > MAX_BEATS) {
    errors.push(`beats must contain at most ${MAX_BEATS} items (got ${rawBeats.length})`);
    return { ok: false, errors };
  }

  let total = 0;
  const beats: Beat[] = [];
  rawBeats.forEach((raw: unknown, i: number) => {
    if (!isObj(raw)) {
      errors.push(`beat ${i}: must be an object`);
      return;
    }
    const bi = toNum(raw.beat_index);
    const p = Number.isFinite(bi) ? `beat ${bi} (position ${i})` : `beat position ${i}`;
    const beat: Record<string, unknown> = { ...raw };

    if (Number.isFinite(bi)) {
      beat.beat_index = bi;
    } else {
      errors.push(`${p}: beat_index must be a number`);
    }
    if (raw.type !== 'avatar' && raw.type !== 'broll' && raw.type !== 'stat') {
      errors.push(`${p}: type must be one of avatar|broll|stat`);
    }
    const d = toNum(raw.duration_sec);
    if (!Number.isFinite(d) || d < MIN_BEAT_SEC || d > MAX_BEAT_SEC) {
      errors.push(`${p}: duration_sec must be a finite number between ${MIN_BEAT_SEC} and ${MAX_BEAT_SEC}`);
    } else {
      beat.duration_sec = d;
      total += d;
    }

    if (raw.type === 'avatar' && !isHttps(raw.clip_url)) {
      errors.push(`${p}: avatar beats require an https:// clip_url`);
    }

    // Photo policy: every beat needs a human-approved https photo. No fallback, ever: a missing or bad
    // photo is a hard stop. Error text never echoes the URL (it can embed secrets).
    if (raw.photo_url === undefined || raw.photo_url === null || raw.photo_url === '') {
      errors.push(`${p}: photo_url missing`);
    } else if (!isHttps(raw.photo_url) || raw.photo_url.length > MAX_URL_LEN) {
      errors.push(`${p}: photo_url invalid (must be https:// and at most ${MAX_URL_LEN} chars)`);
    }

    if (raw.overlay_text !== undefined && raw.overlay_text !== null) {
      if (typeof raw.overlay_text !== 'string') {
        errors.push(`${p}: overlay_text must be a string`);
      } else {
        const t = raw.overlay_text.trim();
        beat.overlay_text = clamp(t, MAX_OVERLAY);
        if (t.length > MAX_OVERLAY) warnings.push(`${p}: overlay_text clamped to ${MAX_OVERLAY} chars`);
      }
    }

    if (raw.type === 'stat') {
      const s = raw.stat;
      if (!isObj(s)) {
        errors.push(`${p}: stat beats require a stat object`);
      } else {
        const ns: Record<string, unknown> = { ...s };
        const valueOk = typeof s.value === 'number' && Number.isFinite(s.value);
        if (!valueOk) errors.push(`${p}: stat.value must be a finite number`);
        if (typeof s.label !== 'string' || s.label.trim() === '') {
          errors.push(`${p}: stat.label must be a non-empty string`);
        } else {
          const l = s.label.trim();
          ns.label = clamp(l, MAX_LABEL);
          if (l.length > MAX_LABEL) warnings.push(`${p}: stat.label clamped to ${MAX_LABEL} chars`);
        }
        let affixOk = true;
        for (const k of ['prefix', 'suffix'] as const) {
          const v = s[k];
          if (v !== undefined && (typeof v !== 'string' || v.length > MAX_AFFIX)) {
            errors.push(`${p}: stat.${k} must be a string of at most ${MAX_AFFIX} chars`);
            affixOk = false;
          }
        }
        const dec = s.decimals;
        const decOk = dec === undefined || (Number.isInteger(dec) && (dec as number) >= 0 && (dec as number) <= 2);
        if (!decOk) errors.push(`${p}: stat.decimals must be an integer 0..2`);
        if (valueOk && affixOk && decOk) {
          const f = formatStat(
            s.value as number,
            (dec as number | undefined) ?? 0,
            (s.prefix as string | undefined) ?? '',
            (s.suffix as string | undefined) ?? '',
          );
          if (f.length > MAX_STAT_CHARS) {
            errors.push(`${p}: formatted stat "${f}" is ${f.length} chars (max ${MAX_STAT_CHARS})`);
          }
        }
        beat.stat = ns;
      }
    }
    beats.push(beat as unknown as Beat);
  });

  if (total > MAX_TOTAL_SEC) {
    errors.push(`total beat duration ${total}s exceeds ${MAX_TOTAL_SEC}s`);
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    inputProps: { ...(inputProps as object), fps: REQUIRED_FPS, beats } as NormalizedProps,
    warnings,
  };
}
