export const MUSIC_VOLUME = 0.045;

export const musicVolume = (
  frame: number,
  totalFrames: number,
  fps: number,
  peak = MUSIC_VOLUME,
  fadeSeconds = 1,
): number => {
  const fade = Math.max(1, Math.round(fps * fadeSeconds));
  const fadeIn = Math.min(1, frame / fade);
  const fadeOut = Math.min(1, (totalFrames - frame) / fade);
  return Math.max(0, peak * Math.min(fadeIn, fadeOut));
};
