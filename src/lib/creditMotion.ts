// Photo credit motion (owner, 2026-10-03): slides in from the left just after its photo lands and
// slides back out the same way just before the photo leaves - one more moving element on screen.
export const CREDIT_IN_DELAY_SECONDS = 0.35; // let the photo's slam/cut settle first
export const CREDIT_SLIDE_SECONDS = 0.4;
export const CREDIT_OUT_LEAD_SECONDS = 0.15; // gone before the whisk-out cut

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// 0 = fully off-screen left, 1 = fully in place. `frame` is local to the beat.
export const creditProgress = (frame: number, durationInFrames: number, fps: number): number => {
  const slide = Math.max(1, Math.round(CREDIT_SLIDE_SECONDS * fps));
  const inStart = Math.round(CREDIT_IN_DELAY_SECONDS * fps);
  const outEnd = durationInFrames - Math.round(CREDIT_OUT_LEAD_SECONDS * fps);
  const outStart = outEnd - slide;
  if (outStart <= inStart + slide) return 0; // beat too short for a clean in/out: stay hidden
  const pIn = easeOutCubic(clamp01((frame - inStart) / slide));
  const pOut = easeOutCubic(clamp01((outEnd - frame) / slide)); // mirror of the slide-in
  return Math.min(pIn, pOut);
};
