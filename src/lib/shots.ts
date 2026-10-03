// Shot plan for one beat's photo: splits the beat into shots (crop changes on the same photo),
// each with an entry style. Pure + deterministic (seeded PRNG, no Math.random / Date.now).
// Rule (owner decision 2026-10-03): crops only when an upstream focal point was captured --
// no focal means one full-frame shot, the image as-is.
import type { Focal } from '../types/beat';

export type ShotEntry = 'none' | 'slam' | 'hardPunch' | 'whip';
export type Shot = { from: number; durationInFrames: number; scale: number; entry: ShotEntry; whiskOut: boolean };
export type PlanOptions = { focal?: Focal | null; seed: number; slamIn: boolean; whiskOut: boolean };

export const WIDE_SCALE = 1.04; // not 1.0: leaves overscan for the slam overshoot and micro-shake
export const MID_SCALE = 1.1; // reserved for the 2-photos-per-beat phase
export const TIGHT_SCALE = 1.35; // cap: sources are ~1200px wide, already ~2.4x upscaled to fill 1080x1920
export const FRAMING_CYCLE = [WIDE_SCALE, TIGHT_SCALE, MID_SCALE];
// Owner review 2026-10-03: 3-4 cuts per beat felt too fast; one cut per beat (wide -> tight) felt right.
const MIN_SHOT_SEC = 3;
const MAX_SHOTS = 2;

const mulberry32 = (seed: number): number => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const shotCount = (durationInFrames: number, fps: number, hasFocal: boolean): number => {
  if (!hasFocal) return 1;
  const sec = durationInFrames / fps;
  return Math.max(1, Math.min(MAX_SHOTS, Math.floor(sec / MIN_SHOT_SEC)));
};

export const planShots = (durationInFrames: number, fps: number, opts: PlanOptions): Shot[] => {
  if (durationInFrames <= 0) return [];
  const n = shotCount(durationInFrames, fps, !!opts.focal);
  const first: ShotEntry = mulberry32(opts.seed) < 0.5 ? 'hardPunch' : 'whip';
  const second: ShotEntry = first === 'hardPunch' ? 'whip' : 'hardPunch';
  const shots: Shot[] = [];
  for (let i = 0; i < n; i++) {
    const from = Math.round((i * durationInFrames) / n);
    const to = Math.round(((i + 1) * durationInFrames) / n);
    const entry: ShotEntry = i === 0 ? (opts.slamIn ? 'slam' : 'none') : i % 2 === 1 ? first : second;
    shots.push({
      from,
      durationInFrames: to - from,
      scale: FRAMING_CYCLE[i % FRAMING_CYCLE.length],
      entry,
      whiskOut: i === n - 1 && opts.whiskOut,
    });
  }
  return shots;
};

// object-position p% puts the image point at fraction p at fraction p of the frame (cover fit),
// so the focal point is always on screen even when a landscape photo is cropped to portrait.
export const focalObjectPosition = (focal?: Focal | null): string =>
  focal ? `${(focal.x * 100).toFixed(2)}% ${(focal.y * 100).toFixed(2)}%` : 'center top';
