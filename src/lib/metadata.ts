import { layoutBeats, totalFrames } from './layout';

export const compositionMetadata = (
  beats: { duration_sec: number }[],
  fps: number,
): { durationInFrames: number; fps: number } => ({
  durationInFrames: totalFrames(layoutBeats(beats, fps)),
  fps,
});
