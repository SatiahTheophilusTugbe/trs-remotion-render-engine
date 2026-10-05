// Shot plan for one beat's photo: splits the beat into shots (crop changes on the same photo),
// each with an entry style and a hold move. Pure + deterministic (seeded PRNG, no Math.random /
// Date.now).
// Crop rule (owner decisions 2026-10-03): crop only when upstream Claude Vision captured a subject
// box AND the photo's pixel size is known, and only as far as keeps the WHOLE box on screen. A box
// too big to crop (line-ups, group shots, crowds) keeps the beat wide, as-is.
import type { Focal } from '../types/beat';

export type ShotEntry = 'none' | 'slam' | 'hardPunch' | 'whip';
export type HoldMove = 'pushIn' | 'pullOut' | 'driftLeft' | 'driftRight' | 'rise';
export type Shot = {
  from: number;
  durationInFrames: number;
  scale: number;
  entry: ShotEntry;
  whiskOut: boolean;
  move: HoldMove;
};
export type PlanOptions = {
  focal?: Focal | null;
  aspect?: number | null; // photo width / height
  seed: number;
  slamIn: boolean;
  whiskOut: boolean;
};

export const WIDE_SCALE = 1.04; // not 1.0: leaves overscan for the slam overshoot and micro-shake
export const MID_SCALE = 1.1; // reserved for the 2-photos-per-beat phase
export const TIGHT_SCALE = 1.35; // cap: sources are ~1200px wide, already ~2.4x upscaled to fill 1080x1920
export const MIN_CROP_SCALE = 1.12; // a safe crop tighter than wide by less than this isn't worth a cut
export const FRAMING_CYCLE = [WIDE_SCALE, TIGHT_SCALE, MID_SCALE];
export const FRAME_ASPECT = 1080 / 1920;
// Hold moves (owner review 2026-10-03: one-cut beats felt idle). Largest extra scale and drift a
// move adds; shotMotion applies them, the crop-safety check below budgets for them.
export const MOVE_SCALE = 1.08;
export const MOVE_SHIFT = 0.03; // fraction of the frame
export const SUBJECT_MARGIN = 0.05; // keep the subject box at least this far inside the frame edges
// Claude's subject boxes are approximate (live test 2026-10-03: centre ~0.1 off on a head shot), so
// every box is treated as this much larger before the fit check -- slack against model imprecision.
export const BOX_PAD = 1.25;
export const HOLD_MOVES: HoldMove[] = ['pushIn', 'driftLeft', 'pullOut', 'rise', 'driftRight'];
// Owner review 2026-10-03: 3-4 cuts per beat felt too fast; one cut per beat (wide -> tight) felt right.
const MIN_SHOT_SEC = 3;
const MAX_SHOTS = 2;

const mulberry32 = (seed: number): number => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Fraction of the photo visible in the frame under object-fit: cover.
export const visibleFraction = (aspect: number): { vw: number; vh: number } =>
  aspect > FRAME_ASPECT ? { vw: FRAME_ASPECT / aspect, vh: 1 } : { vw: 1, vh: aspect / FRAME_ASPECT };

// Frame-space extent of the subject box along one axis at zoom s. object-position = focal puts the
// box centre c at frame fraction c, so a half-width `half` (frame units) spans c +/- half; the
// zoom is centred with the same clamped translate shotMotion uses.
const boxSpan = (c: number, half: number, s: number): [number, number] => {
  const t = Math.max(-(s - 1) / 2, Math.min((s - 1) / 2, -s * (c - 0.5)));
  return [0.5 + t + s * (c - half - 0.5), 0.5 + t + s * (c + half - 0.5)];
};

/**
 * Largest zoom (at most TIGHT_SCALE) that keeps the whole subject box on screen at every point of
 * a hold move, or null when there is no box / unknown photo size, or when even MIN_CROP_SCALE
 * would cut the subject (line-ups, group shots) -- those beats stay wide, as-is.
 */
export const safeCropScale = (focal: Focal | null | undefined, aspect: number | null | undefined): number | null => {
  if (!focal || focal.w === undefined || focal.h === undefined || !aspect || !(aspect > 0)) return null;
  const { vw, vh } = visibleFraction(aspect);
  const halfW = (focal.w * BOX_PAD) / 2 / vw;
  const halfH = (focal.h * BOX_PAD) / 2 / vh;
  const lo = SUBJECT_MARGIN + MOVE_SHIFT;
  const hi = 1 - lo;
  const fits = (s: number) =>
    [s, s * MOVE_SCALE].every((z) => {
      const [x0, x1] = boxSpan(focal.x, halfW, z);
      const [y0, y1] = boxSpan(focal.y, halfH, z);
      return x0 >= lo && x1 <= hi && y0 >= lo && y1 <= hi;
    });
  for (let i = Math.round(TIGHT_SCALE * 100); i >= Math.round(MIN_CROP_SCALE * 100); i--) {
    if (fits(i / 100)) return i / 100;
  }
  return null;
};

export type PhotoLayout = 'cover' | 'letterbox' | 'small';

// Small photos (to-do A6, 2026-10-05): a 300x390 Telegram headshot filled the 1080x1920 frame at ~4.9x, a
// forehead-to-lips crop. A photo whose longest side is under SMALL_PHOTO_MAX_SIDE (the same 600px bar pasted
// links must pass) is shown whole, at most SMALL_MAX_UPSCALE times its real size, as a card over a blurred copy.
export const SMALL_PHOTO_MAX_SIDE = 600;
export const SMALL_MAX_UPSCALE = 2;
export const isSmallPhoto = (w?: number, h?: number): boolean =>
  !!w && !!h && Math.max(w, h) < SMALL_PHOTO_MAX_SIDE;
/** On-screen size of a small photo: its real size times SMALL_MAX_UPSCALE, never beyond 90% of the frame. */
export const smallPhotoSize = (w: number, h: number, frameW = 1080, frameH = 1920): { width: number; height: number } => {
  const s = Math.min(SMALL_MAX_UPSCALE, (frameW * 0.9) / w, (frameH * 0.9) / h);
  return { width: Math.round(w * s), height: Math.round(h * s) };
};
// Group boxes (line-ups, celebrations) span most of the photo; single-person boxes from Claude run
// ~0.3-0.4 wide (live run 39961). Only a box at least this wide is treated as a group.
export const GROUP_MIN_W = 0.55;

/**
 * Group photos (owner, 2026-10-03): when a landscape photo's padded subject box is wider than the strip
 * a 9:16 frame can show, no safe crop exists and full-bleed would cut the group off at the sides -- show
 * the WHOLE photo instead (letterboxed over a blurred copy). Everything else stays full-bleed cover.
 */
export const photoLayout = (focal: Focal | null | undefined, aspect: number | null | undefined, w?: number, h?: number): PhotoLayout => {
  if (isSmallPhoto(w, h)) return 'small';
  if (!focal || focal.w === undefined || focal.h === undefined || !aspect || !(aspect > FRAME_ASPECT)) return 'cover';
  if (focal.w < GROUP_MIN_W || safeCropScale(focal, aspect) !== null) return 'cover';
  const { vw } = visibleFraction(aspect);
  return (focal.w * BOX_PAD) / vw > 1 - 2 * SUBJECT_MARGIN ? 'letterbox' : 'cover';
};

export const shotCount = (durationInFrames: number, fps: number, canCrop: boolean): number => {
  if (!canCrop) return 1;
  const sec = durationInFrames / fps;
  return Math.max(1, Math.min(MAX_SHOTS, Math.floor(sec / MIN_SHOT_SEC)));
};

export const planShots = (durationInFrames: number, fps: number, opts: PlanOptions): Shot[] => {
  if (durationInFrames <= 0) return [];
  const crop = safeCropScale(opts.focal, opts.aspect);
  const n = shotCount(durationInFrames, fps, crop !== null);
  const first: ShotEntry = mulberry32(opts.seed) < 0.5 ? 'hardPunch' : 'whip';
  const second: ShotEntry = first === 'hardPunch' ? 'whip' : 'hardPunch';
  // Step 2 through the 5-move pool so consecutive shots never repeat a move.
  const moveStart = Math.floor(mulberry32(opts.seed + 7919) * HOLD_MOVES.length) % HOLD_MOVES.length;
  const shots: Shot[] = [];
  for (let i = 0; i < n; i++) {
    const from = Math.round((i * durationInFrames) / n);
    const to = Math.round(((i + 1) * durationInFrames) / n);
    const entry: ShotEntry = i === 0 ? (opts.slamIn ? 'slam' : 'none') : i % 2 === 1 ? first : second;
    shots.push({
      from,
      durationInFrames: to - from,
      scale: i === 0 || crop === null ? WIDE_SCALE : crop,
      entry,
      whiskOut: i === n - 1 && opts.whiskOut,
      move: HOLD_MOVES[(moveStart + i * 2) % HOLD_MOVES.length],
    });
  }
  return shots;
};

// object-position p% puts the image point at fraction p at fraction p of the frame (cover fit),
// so the subject centre is always on screen even when a landscape photo is cropped to portrait.
export const focalObjectPosition = (focal?: Focal | null): string =>
  focal ? `${(focal.x * 100).toFixed(2)}% ${(focal.y * 100).toFixed(2)}%` : 'center top';
