// Shot plan for one beat's photo: splits the beat into shots (crop changes on the same photo),
// each with an entry style and a hold move. Pure + deterministic (seeded PRNG, no Math.random /
// Date.now).
// Crop rule (owner decisions 2026-10-03): crop only when upstream Claude Vision captured a subject
// box AND the photo's pixel size is known, and only as far as keeps the WHOLE box on screen. A box
// too big to crop (line-ups, group shots, crowds) keeps the beat wide, as-is.
import type { Focal } from '../types/beat';

export type ShotEntry = 'none' | 'slam' | 'sweep' | InnerCut;
// Cuts between shots inside one beat, picked at random per cut (owner, 2026-10-08).
export type InnerCut = 'hardPunch' | 'whip' | 'whipUp' | 'crashZoom';
export const INNER_CUTS: InnerCut[] = ['hardPunch', 'whip', 'whipUp', 'crashZoom'];
export type HoldMove = 'pushIn' | 'pullOut' | 'driftLeft' | 'driftRight' | 'rise';
export type Shot = {
  from: number;
  durationInFrames: number;
  scale: number;
  entry: ShotEntry;
  whiskOut: boolean;
  /** Last shot before a lime-wipe cut: shoved along with the wipe instead of whisking. */
  sweepOut: boolean;
  move: HoldMove;
  /** Largest extra scale / drift (fraction of frame) this shot's hold move adds. */
  moveScale: number;
  moveShift: number;
};
export type PlanOptions = {
  focal?: Focal | null;
  aspect?: number | null; // photo width / height
  /**
   * How the photo is shown (photoLayout). Only 'cover' crops the photo to the frame, so only cover photos
   * budget their wide motion against the subject box; letterbox / small cards show the whole photo.
   */
  layout?: PhotoLayout;
  seed: number;
  slamIn: boolean;
  whiskOut: boolean;
  /**
   * The beat starts / ends on a lime-wipe cut (owner, 2026-10-08: slam + whisk under the wipe looked
   * messy). The photo then rides the wipe instead: sweepIn replaces the slam, sweepOut the whisk.
   */
  sweepIn?: boolean;
  sweepOut?: boolean;
};

export const WIDE_SCALE = 1.04; // not 1.0: leaves overscan for the slam overshoot and micro-shake
export const MID_SCALE = 1.1; // reserved for the 2-photos-per-beat phase
export const TIGHT_SCALE = 1.35; // cap: sources are ~1200px wide, already ~2.4x upscaled to fill 1080x1920
export const MIN_CROP_SCALE = 1.12; // a safe crop tighter than wide by less than this isn't worth a cut
export const FRAMING_CYCLE = [WIDE_SCALE, TIGHT_SCALE, MID_SCALE];
export const FRAME_ASPECT = 1080 / 1920;
// Hold moves (owner review 2026-10-03: one-cut beats felt idle). Largest extra scale and drift a
// move adds; shotMotion applies them, the crop-safety check below budgets for them.
// These are the TIGHT (cropped) shot's moves; safeCropScale budgets for them.
export const MOVE_SCALE = 1.08;
export const MOVE_SHIFT = 0.03; // fraction of the frame
// Wide shots move much harder (owner review 2026-10-08: photos "almost not moving" on 10-18s beats --
// wanted dramatic motion). Owner review 2026-10-11: the full wide move pushed faces out of frame, so a
// wide shot WITH a subject box only gets as much of it as keeps the padded box on screen
// (wideMoveBudget); photos without a box keep the full move.
export const WIDE_MOVE_SCALE = 1.2;
export const WIDE_MOVE_SHIFT = 0.08;
export const SUBJECT_MARGIN = 0.05; // keep the subject box at least this far inside the frame edges
// Where the subject box centre is placed in the frame (owner, 2026-10-11): horizontally centred,
// vertically a little high (faces read better above the middle). Clamped so no photo edge shows.
export const SUBJECT_TARGET_X = 0.5;
export const SUBJECT_TARGET_Y = 0.42;
// Claude's subject boxes are approximate (live test 2026-10-03: centre ~0.1 off on a head shot), so
// every box is treated as this much larger before the fit check -- slack against model imprecision.
export const BOX_PAD = 1.25;
export const HOLD_MOVES: HoldMove[] = ['pushIn', 'driftLeft', 'pullOut', 'rise', 'driftRight'];
// Owner review 2026-10-03: 3-4 cuts per beat felt too fast; one cut per beat (wide -> tight) felt right
// on ~8-10s beats. Owner review 2026-10-08: live beats now run 10-18s and one 9-18s shot read as a
// still, so a long beat is re-cut every ~5.5s (never under 3s), on uncroppable photos too.
const MIN_SHOT_SEC = 3;
export const MAX_SHOT_SEC = 5.5;
const MAX_SHOTS = 4;

const mulberry32 = (seed: number): number => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Fraction of the photo visible in the frame under object-fit: cover.
export const visibleFraction = (aspect: number): { vw: number; vh: number } =>
  aspect > FRAME_ASPECT ? { vw: FRAME_ASPECT / aspect, vh: 1 } : { vw: 1, vh: aspect / FRAME_ASPECT };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Under object-fit: cover, object-position p on an axis whose visible fraction is v puts image point u
 * at frame fraction p * (1 - 1/v) + u / v. Picks the p (clamped to 0..1, so no photo edge shows) that
 * puts image point c at frame fraction `target`, and returns where c actually lands. An axis whose
 * whole extent is visible (v = 1) is unaffected by object-position: c stays at c.
 */
const placeOnAxis = (c: number, v: number, target: number): { p: number; at: number } => {
  if (!(v < 1)) return { p: c, at: c };
  const p = clamp((c - target * v) / (1 - v), 0, 1);
  return { p, at: p * (1 - 1 / v) + c / v };
};

export type SubjectPosition = {
  /** Frame fractions (0-1) where the subject box centre sits before any zoom / translate. */
  x: number;
  y: number;
  /** CSS object-position for the cover-fit photo that produces that placement. */
  objectPosition: string;
};

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

/**
 * Where the subject box centre lands in the frame, and the object-position that puts it there. With the
 * photo size known, the box centre is placed at (SUBJECT_TARGET_X, SUBJECT_TARGET_Y), clamped so no
 * photo edge shows. Without the size, the old proportional placement (object-position = focal, which
 * leaves the centre at frame fraction focal) is kept. No focal: null (the renderer uses 'center top').
 */
export const subjectFramePosition = (
  focal: Focal | null | undefined,
  aspect: number | null | undefined,
): SubjectPosition | null => {
  if (!focal) return null;
  if (!aspect || !(aspect > 0)) return { x: focal.x, y: focal.y, objectPosition: `${pct(focal.x)} ${pct(focal.y)}` };
  const { vw, vh } = visibleFraction(aspect);
  const h = placeOnAxis(focal.x, vw, SUBJECT_TARGET_X);
  const v = placeOnAxis(focal.y, vh, SUBJECT_TARGET_Y);
  return { x: h.at, y: v.at, objectPosition: `${pct(h.p)} ${pct(v.p)}` };
};

/**
 * Translate (fraction of the frame) that moves frame point `at` toward `target` under a zoom s about the
 * frame centre, clamped to the edge-safe bound (s - 1) / 2. shotMotion applies the same translate.
 */
export const subjectTranslate = (at: number, target: number, s: number): number =>
  clamp(target - 0.5 - s * (at - 0.5), -(s - 1) / 2, (s - 1) / 2);

// Frame-space extent of the subject box along one axis at zoom s: box centre at frame fraction `at`
// (subjectFramePosition), half-size `half` (frame units), centred with the clamped subjectTranslate.
const boxSpan = (at: number, half: number, s: number, target: number): [number, number] => {
  const t = subjectTranslate(at, target, s);
  return [0.5 + t + s * (at - half - 0.5), 0.5 + t + s * (at + half - 0.5)];
};

type PaddedBox = { pos: SubjectPosition; halfW: number; halfH: number };
const paddedBox = (focal: Focal | null | undefined, aspect: number | null | undefined): PaddedBox | null => {
  if (!focal || focal.w === undefined || focal.h === undefined || !aspect || !(aspect > 0)) return null;
  const { vw, vh } = visibleFraction(aspect);
  return {
    pos: subjectFramePosition(focal, aspect)!,
    halfW: (focal.w * BOX_PAD) / 2 / vw,
    halfH: (focal.h * BOX_PAD) / 2 / vh,
  };
};

// The padded box stays at least SUBJECT_MARGIN + shift inside every frame edge at every zoom of a hold
// that runs from s to s * moveScale (sampled; a drift of up to `shift` is budgeted as extra margin).
const boxFits = (b: PaddedBox, s: number, moveScale: number, shift: number): boolean => {
  const lo = SUBJECT_MARGIN + shift - 1e-9;
  const hi = 1 - lo;
  for (let i = 0; i <= 8; i++) {
    const z = s * (1 + ((moveScale - 1) * i) / 8);
    const [x0, x1] = boxSpan(b.pos.x, b.halfW, z, SUBJECT_TARGET_X);
    const [y0, y1] = boxSpan(b.pos.y, b.halfH, z, SUBJECT_TARGET_Y);
    if (!(x0 >= lo && x1 <= hi && y0 >= lo && y1 <= hi)) return false;
  }
  return true;
};

/**
 * Largest zoom (at most TIGHT_SCALE) that keeps the whole subject box on screen at every point of
 * a hold move, or null when there is no box / unknown photo size, or when even MIN_CROP_SCALE
 * would cut the subject (line-ups, group shots) -- those beats stay wide, as-is.
 */
export const safeCropScale = (focal: Focal | null | undefined, aspect: number | null | undefined): number | null => {
  const b = paddedBox(focal, aspect);
  if (!b) return null;
  for (let i = Math.round(TIGHT_SCALE * 100); i >= Math.round(MIN_CROP_SCALE * 100); i--) {
    if (boxFits(b, i / 100, MOVE_SCALE, MOVE_SHIFT)) return i / 100;
  }
  return null;
};

export type MoveBudget = { moveScale: number; moveShift: number };
export const WIDE_BUDGET_STEPS = 12;
/**
 * Hold-move budget for a WIDE shot (owner, 2026-10-11). No subject box, or a photo that is not cover-
 * cropped: the full WIDE_MOVE_SCALE / WIDE_MOVE_SHIFT. With a box: the largest step from the full wide
 * move down to the tight move (MOVE_SCALE / MOVE_SHIFT) that keeps the padded box inside the frame
 * margins; if even that cuts the box (a loose box wider than the visible strip), MOVE_SCALE with zero
 * drift. A box on a photo of unknown size cannot be checked, so it gets the tight move.
 */
export const wideMoveBudget = (
  focal: Focal | null | undefined,
  aspect: number | null | undefined,
  layout: PhotoLayout = 'cover',
): MoveBudget => {
  if (!focal || focal.w === undefined || focal.h === undefined || layout !== 'cover') {
    return { moveScale: WIDE_MOVE_SCALE, moveShift: WIDE_MOVE_SHIFT };
  }
  const b = paddedBox(focal, aspect);
  if (!b) return { moveScale: MOVE_SCALE, moveShift: MOVE_SHIFT };
  for (let i = 0; i <= WIDE_BUDGET_STEPS; i++) {
    const k = i / WIDE_BUDGET_STEPS;
    const moveScale = Math.round((WIDE_MOVE_SCALE + (MOVE_SCALE - WIDE_MOVE_SCALE) * k) * 1e4) / 1e4;
    const moveShift = Math.round((WIDE_MOVE_SHIFT + (MOVE_SHIFT - WIDE_MOVE_SHIFT) * k) * 1e4) / 1e4;
    if (boxFits(b, WIDE_SCALE, moveScale, moveShift)) return { moveScale, moveShift };
  }
  return { moveScale: MOVE_SCALE, moveShift: 0 };
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

export const shotCount = (durationInFrames: number, fps: number): number => {
  const sec = durationInFrames / fps;
  return Math.max(1, Math.min(MAX_SHOTS, Math.ceil(sec / MAX_SHOT_SEC), Math.floor(sec / MIN_SHOT_SEC)));
};

export const planShots = (durationInFrames: number, fps: number, opts: PlanOptions): Shot[] => {
  if (durationInFrames <= 0) return [];
  const crop = safeCropScale(opts.focal, opts.aspect);
  const wide = wideMoveBudget(opts.focal, opts.aspect, opts.layout);
  const n = shotCount(durationInFrames, fps);
  // Each inner cut is drawn at random from INNER_CUTS, never the same as the cut before it.
  const cuts: InnerCut[] = [];
  for (let i = 1; i < n; i++) {
    const pool = INNER_CUTS.filter((c) => c !== cuts[cuts.length - 1]);
    cuts.push(pool[Math.floor(mulberry32(opts.seed * 31 + i) * pool.length) % pool.length]);
  }
  const firstEntry: ShotEntry = opts.sweepIn ? 'sweep' : opts.slamIn ? 'slam' : 'none';
  const sweepOut = !!opts.sweepOut;
  // Step 2 through the 5-move pool so consecutive shots never repeat a move.
  const moveStart = Math.floor(mulberry32(opts.seed + 7919) * HOLD_MOVES.length) % HOLD_MOVES.length;
  const shots: Shot[] = [];
  for (let i = 0; i < n; i++) {
    const from = Math.round((i * durationInFrames) / n);
    const to = Math.round(((i + 1) * durationInFrames) / n);
    const entry: ShotEntry = i === 0 ? firstEntry : cuts[i - 1];
    // Wide, then alternate with the safe crop; a photo that can't be cropped stays wide on every shot.
    const tight = crop !== null && i % 2 === 1;
    const budget = tight ? { moveScale: MOVE_SCALE, moveShift: MOVE_SHIFT } : wide;
    const prev = shots[i - 1]?.move;
    let slot = (moveStart + i * 2) % HOLD_MOVES.length;
    let move = HOLD_MOVES[slot];
    if (budget.moveShift === 0) {
      // A zero-drift budget would freeze a drift / rise into a still zoom: push or pull instead,
      // never the same as the shot before.
      if ((move !== 'pushIn' && move !== 'pullOut') || move === prev) move = prev === 'pushIn' ? 'pullOut' : 'pushIn';
    } else {
      // The pool step never repeats on its own; a repeat is only possible after a swap above.
      while (move === prev) move = HOLD_MOVES[(slot = (slot + 1) % HOLD_MOVES.length)];
    }
    shots.push({
      from,
      durationInFrames: to - from,
      scale: tight ? crop : WIDE_SCALE,
      entry,
      whiskOut: i === n - 1 && opts.whiskOut && !sweepOut,
      sweepOut: i === n - 1 && sweepOut,
      move,
      ...budget,
    });
  }
  return shots;
};

// CSS object-position for the cover-fit photo: the subject box centred (subjectFramePosition) when the
// photo size is known, the old proportional focal placement when it is not, 'center top' without a focal.
export const focalObjectPosition = (focal?: Focal | null, aspect?: number | null): string =>
  subjectFramePosition(focal, aspect)?.objectPosition ?? 'center top';
