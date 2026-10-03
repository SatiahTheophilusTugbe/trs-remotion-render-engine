// Photo credit motion (owner, 2026-10-03): slides in from the left just after its photo lands and
// slides back out the same way after a short hold (or before the photo leaves, if sooner).
export const CREDIT_IN_DELAY_SECONDS = 0.35; // let the photo's slam/cut settle first
export const CREDIT_SLIDE_SECONDS = 0.4;
export const CREDIT_OUT_LEAD_SECONDS = 0.15; // gone before the whisk-out cut
export const CREDIT_HOLD_SECONDS = 2.5; // owner: brief, not the whole photo (2026-10-03)

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// 0 = fully off-screen left, 1 = fully in place. `frame` is local to the beat.
export const creditProgress = (frame: number, durationInFrames: number, fps: number): number => {
  const slide = Math.max(1, Math.round(CREDIT_SLIDE_SECONDS * fps));
  const inStart = Math.round(CREDIT_IN_DELAY_SECONDS * fps);
  const hold = Math.round(CREDIT_HOLD_SECONDS * fps);
  // Out after the hold, or earlier if the photo leaves first.
  const outEnd = Math.min(inStart + slide + hold + slide, durationInFrames - Math.round(CREDIT_OUT_LEAD_SECONDS * fps));
  const outStart = outEnd - slide;
  if (outStart <= inStart + slide) return 0; // beat too short for a clean in/out: stay hidden
  const pIn = easeOutCubic(clamp01((frame - inStart) / slide));
  const pOut = easeOutCubic(clamp01((outEnd - frame) / slide)); // mirror of the slide-in
  return Math.min(pIn, pOut);
};
