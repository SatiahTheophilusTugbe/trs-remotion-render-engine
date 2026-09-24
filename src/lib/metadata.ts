import { framesForBeats } from './duration';

export const compositionMetadata = (
  beats: { duration_sec: number }[],
  fps: number,
): { durationInFrames: number; fps: number } => ({
  durationInFrames: framesForBeats(beats, fps),
  fps,
});
