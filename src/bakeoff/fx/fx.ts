import { useCurrentFrame, useVideoConfig } from 'remotion';

export type FxProps = { children: React.ReactNode; isFirst: boolean; isLast: boolean };

// Frame bookkeeping inside a beat <Sequence>: local frame + beat length.
export const useBeatFrames = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return { frame, durationInFrames };
};
