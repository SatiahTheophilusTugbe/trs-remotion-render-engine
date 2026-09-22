export const framesForBeats = (
  beats: { duration_sec: number }[],
  fps: number,
): number => {
  const totalSeconds = beats.reduce((sum, beat) => sum + beat.duration_sec, 0);
  return Math.round(totalSeconds * fps);
};
