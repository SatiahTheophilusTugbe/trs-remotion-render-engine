// Per-frame transform + blur for a planned shot list (see shots.ts). Pure. Translate is in % of
// the frame and applied as `translate(tx%, ty%) scale(s)` around the centre, so the edge-safe
// bound is |t| <= (s - 1) * 50. Values are tuned by eye on real Lambda renders.
import { Easing, interpolate } from 'remotion';
import type { Focal } from '../types/beat';
import { MOVE_SCALE, MOVE_SHIFT, type HoldMove, type Shot } from './shots';

export type ShotFrame = { scale: number; txPct: number; tyPct: number; blurX: number; blurY: number };

export const SLAM_FRAMES = 8; // lands just after the 5-frame wipe half clears
export const SLAM_OVERSIZE = 1.25;
export const SLAM_BLUR = 28;
export const SHAKE_FRAMES = 4;
export const SHAKE_PCT = 0.9;
export const PUNCH_FRAMES = 3;
export const PUNCH_AMT = 0.03;
export const WHIP_FRAMES = 3; // per side of the cut
export const WHIP_SHIFT_PCT = 6;
export const WHIP_BUMP = 0.14; // extra scale during the whip so the shift never exposes an edge
export const WHIP_BLUR = 44;
export const WHISK_FRAMES = 6;
export const WHISK_SCALE = 1.3;
export const WHISK_SHIFT_PCT = -5;
export const WHISK_BLUR = 36;

const IDLE: ShotFrame = { scale: 1, txPct: 0, tyPct: 0, blurX: 0, blurY: 0 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pseudoRand = (n: number, seed: number) => {
  const v = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
// Hold move across the whole shot (eased in-out so it never reads as a slow linear pan):
// returns the scale multiplier and drift (in % of frame). Owner review 2026-10-03: the old
// 3% push left beats feeling idle.
const SHIFT_PCT = MOVE_SHIFT * 100;
export const holdMove = (move: HoldMove, t: number): { m: number; dx: number; dy: number } => {
  const e = Easing.inOut(Easing.cubic)(clamp(t, 0, 1));
  switch (move) {
    case 'pushIn':
      return { m: 1 + (MOVE_SCALE - 1) * e, dx: 0, dy: 0 };
    case 'pullOut':
      return { m: MOVE_SCALE - (MOVE_SCALE - 1) * e, dx: 0, dy: 0 };
    case 'driftLeft':
      return { m: MOVE_SCALE, dx: SHIFT_PCT * (1 - 2 * e), dy: 0 };
    case 'driftRight':
      return { m: MOVE_SCALE, dx: -SHIFT_PCT * (1 - 2 * e), dy: 0 };
    case 'rise':
      return { m: MOVE_SCALE, dx: 0, dy: SHIFT_PCT * (1 - 2 * e) };
  }
};

// Translate (in % of frame) that brings image fraction f to the frame centre at this scale.
const centreOn = (f: number | undefined, scale: number) => (f === undefined ? 0 : -scale * (f - 0.5) * 100);

export const shotFrameAt = (shots: Shot[], frame: number, focal?: Focal | null): ShotFrame => {
  if (!shots.length) return IDLE;
  let i = shots.findIndex((s) => frame >= s.from && frame < s.from + s.durationInFrames);
  if (i === -1) i = frame < 0 ? 0 : shots.length - 1;
  const shot = shots[i];
  const d = shot.durationInFrames;
  const k = clamp(frame - shot.from, 0, d - 1);

  const hold = holdMove(shot.move, d > 1 ? k / (d - 1) : 0);
  let mult = hold.m;
  let dx = hold.dx;
  let dy = hold.dy;
  let blurX = 0;
  let blurY = 0;

  if (shot.entry === 'slam' && k < SLAM_FRAMES) {
    const p = k / SLAM_FRAMES;
    mult *= interpolate(p, [0, 1], [SLAM_OVERSIZE, 1], { easing: Easing.out(Easing.back(1.7)) });
    blurY = SLAM_BLUR * (1 - p);
  } else if (shot.entry === 'slam' && k < SLAM_FRAMES + SHAKE_FRAMES) {
    const decay = 1 - (k - SLAM_FRAMES) / SHAKE_FRAMES;
    dx += (pseudoRand(frame, 1) - 0.5) * 2 * SHAKE_PCT * decay;
    dy += (pseudoRand(frame, 2) - 0.5) * 2 * SHAKE_PCT * decay;
  } else if (shot.entry === 'hardPunch' && k < PUNCH_FRAMES) {
    mult *= 1 + PUNCH_AMT * (1 - k / PUNCH_FRAMES);
  } else if (shot.entry === 'whip' && k < WHIP_FRAMES) {
    const r = Math.pow(1 - k / WHIP_FRAMES, 2);
    mult *= 1 + WHIP_BUMP * r;
    dx += WHIP_SHIFT_PCT * r;
    blurX = WHIP_BLUR * r;
  }

  const next = shots[i + 1];
  const kWhipOut = k - (d - WHIP_FRAMES);
  const kWhisk = k - (d - WHISK_FRAMES);
  if (next && next.entry === 'whip' && kWhipOut >= 0) {
    const p = Math.pow((kWhipOut + 1) / WHIP_FRAMES, 2);
    mult *= 1 + WHIP_BUMP * p;
    dx -= WHIP_SHIFT_PCT * p;
    blurX = WHIP_BLUR * p;
  } else if (!next && shot.whiskOut && kWhisk >= 0) {
    const p = Easing.in(Easing.cubic)((kWhisk + 1) / WHISK_FRAMES);
    mult *= 1 + (WHISK_SCALE - 1) * p;
    dy += WHISK_SHIFT_PCT * p;
    blurY = Math.max(blurY, WHISK_BLUR * p);
  }

  const scale = Math.max(1, shot.scale * mult);
  const limit = (scale - 1) * 50;
  return {
    scale,
    txPct: clamp(centreOn(focal?.x, scale) + dx, -limit, limit),
    tyPct: clamp(centreOn(focal?.y, scale) + dy, -limit, limit),
    blurX,
    blurY,
  };
};
