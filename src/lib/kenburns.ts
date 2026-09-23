export const kenBurnsScale = (
  frame: number,
  durationInFrames: number,
  startScale = 1,
  endScale = 1.08,
): number => {
  if (durationInFrames <= 0) return startScale;
  const progress = Math.min(Math.max(frame / durationInFrames, 0), 1);
  return startScale + (endScale - startScale) * progress;
};
