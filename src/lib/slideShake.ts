// Pure timing/geometry for the slide-push + shake impact cut (ported from the bake-off A4;
// technique after RenderComp free-remotion-templates SlideWipe + CameraShake, MIT, Trimora Inc.).
// Non-overlapping: the outgoing beat slides out over its last SLIDE_OUT_FRAMES frames, exposing a
// brand-lime strip; the incoming beat slides in from the right over its first SLIDE_IN_FRAMES
// frames (ease-out, lime strip on its left), then lands with a flash and a decaying shake for
// SHAKE_FRAMES frames. Total effect window: 5 + 4 + 8 = 17 frames; shorter beats skip the shake.
import { Easing, interpolate } from 'remotion';

export const SLIDE_OUT_FRAMES = 5;
export const SLIDE_IN_FRAMES = 4;
export const SHAKE_FRAMES = 8;
export const MIN_SHAKE_BEAT_FRAMES = SLIDE_OUT_FRAMES + SLIDE_IN_FRAMES + SHAKE_FRAMES; // 17
export const FRAME_W = 1080;
export const SLIDE_REACH_PX = 432; // 40% of the 1080px frame width
export const SHAKE_AMP_PX = 14;
export const SHAKE_ROT_DEG = 0.8;
export const SHAKE_SCALE = 0.06; // hides the shaken edges
export const FLASH_PEAK = 0.35;
export const STRIP_COLOR = '#CCFF00';

export type SlideShakeState = {
  x: number;
  y: number;
  rot: number;
  scale: number;
  flash: number;
  limePx: number; // width of the lime backdrop strip exposed this frame (rotation ignored)
};

const IDENTITY: SlideShakeState = { x: 0, y: 0, rot: 0, scale: 1, flash: 0, limePx: 0 };

// Horizontal exposure of the backdrop given the content transform (content is centred, scaled).
export const limeExposurePx = (s: Pick<SlideShakeState, 'x' | 'scale'>): number => {
  const centre = FRAME_W / 2 + s.x;
  const half = (FRAME_W / 2) * s.scale;
  const covered = Math.max(0, Math.min(FRAME_W, centre + half) - Math.max(0, centre - half));
  return FRAME_W - covered;
};

const pseudoRand = (n: number, seed: number) => {
  const v = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const withLime = (s: Omit<SlideShakeState, 'limePx'>): SlideShakeState => ({ ...s, limePx: limeExposurePx(s) });

export const slideShakeState = (
  frame: number,
  durationInFrames: number,
  opts: { slideOut: boolean; slideIn: boolean },
): SlideShakeState => {
  const kOut = frame - (durationInFrames - SLIDE_OUT_FRAMES);
  if (opts.slideOut && kOut >= 0) {
    const t = (kOut + 1) / SLIDE_OUT_FRAMES;
    return withLime({ ...IDENTITY, x: -SLIDE_REACH_PX * Easing.in(Easing.cubic)(t) });
  }
  if (!opts.slideIn || frame < 0) return IDENTITY;
  if (durationInFrames < SLIDE_OUT_FRAMES + SLIDE_IN_FRAMES) return IDENTITY;
  if (frame < SLIDE_IN_FRAMES) {
    const x = SLIDE_REACH_PX * (1 - Easing.out(Easing.cubic)(frame / SLIDE_IN_FRAMES));
    return withLime({ ...IDENTITY, x });
  }
  const elapsed = frame - SLIDE_IN_FRAMES; // landing frame = 0
  if (durationInFrames >= MIN_SHAKE_BEAT_FRAMES && elapsed < SHAKE_FRAMES) {
    const decay = interpolate(elapsed, [0, SHAKE_FRAMES], [1, 0], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const flash = interpolate(elapsed, [0, 2, 6], [FLASH_PEAK, FLASH_PEAK * 0.85, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return withLime({
      x: (pseudoRand(frame, 1) - 0.5) * 2 * SHAKE_AMP_PX * decay,
      y: (pseudoRand(frame, 2) - 0.5) * 2 * SHAKE_AMP_PX * decay,
      rot: (pseudoRand(frame, 3) - 0.5) * 2 * SHAKE_ROT_DEG * decay,
      scale: 1 + SHAKE_SCALE * decay,
      flash,
    });
  }
  return IDENTITY;
};
