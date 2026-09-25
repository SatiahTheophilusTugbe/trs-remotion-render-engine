// Pure timing/geometry for the slide-push + shake impact cut (ported from the bake-off A4;
// technique after RenderComp free-remotion-templates SlideWipe + CameraShake, MIT, Trimora Inc.).
// Non-overlapping: the outgoing beat slides out over its last SLIDE_OUT_FRAMES frames; the
// incoming beat is in place on its first frame (so only the last outgoing frame ever shows
// dark backdrop at the cut) and lands with a decaying shake for SHAKE_FRAMES frames plus a flash.
import { Easing, interpolate } from 'remotion';

export const SLIDE_OUT_FRAMES = 5;
export const SHAKE_FRAMES = 8;
export const SLIDE_REACH_PX = 432; // 40% of the 1080px frame width
export const SHAKE_AMP_PX = 14;
export const SHAKE_ROT_DEG = 0.8;
export const SHAKE_SCALE = 0.06; // hides the shaken edges
export const FLASH_PEAK = 0.35;

export type SlideShakeState = {
  x: number;
  y: number;
  rot: number;
  scale: number;
  flash: number;
  darkPx: number; // width of dark backdrop exposed by the slide (0 for the incoming side)
};

const IDENTITY: SlideShakeState = { x: 0, y: 0, rot: 0, scale: 1, flash: 0, darkPx: 0 };

const pseudoRand = (n: number, seed: number) => {
  const v = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export const slideShakeState = (
  frame: number,
  durationInFrames: number,
  opts: { slideOut: boolean; slideIn: boolean },
): SlideShakeState => {
  const kOut = frame - (durationInFrames - SLIDE_OUT_FRAMES);
  if (opts.slideOut && kOut >= 0) {
    const t = (kOut + 1) / SLIDE_OUT_FRAMES;
    const x = -SLIDE_REACH_PX * Easing.in(Easing.cubic)(t);
    return { ...IDENTITY, x, darkPx: Math.abs(x) };
  }
  if (opts.slideIn && frame >= 0 && frame < SHAKE_FRAMES) {
    const decay = interpolate(frame, [0, SHAKE_FRAMES], [1, 0], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const flash = interpolate(frame, [0, 2, 6], [FLASH_PEAK, FLASH_PEAK * 0.85, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return {
      x: (pseudoRand(frame, 1) - 0.5) * 2 * SHAKE_AMP_PX * decay,
      y: (pseudoRand(frame, 2) - 0.5) * 2 * SHAKE_AMP_PX * decay,
      rot: (pseudoRand(frame, 3) - 0.5) * 2 * SHAKE_ROT_DEG * decay,
      scale: 1 + SHAKE_SCALE * decay,
      flash,
      darkPx: 0,
    };
  }
  return IDENTITY;
};
