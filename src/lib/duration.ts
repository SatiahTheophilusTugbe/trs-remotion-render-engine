export const framesForBeat = (
  beat: { duration_sec: number },
  fps: number,
): number => Math.round(beat.duration_sec * fps);

export const framesForBeats = (
  beats: { duration_sec: number }[],
  fps: number,
): number => beats.reduce((sum, beat) => sum + framesForBeat(beat, fps), 0);
