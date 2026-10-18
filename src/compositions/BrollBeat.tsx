import { AbsoluteFill, Audio, useVideoConfig } from 'remotion';
import { MASTER_GAIN } from '../lib/music';
import type { BrollBeatData } from '../types/beat';
import { DEFAULT_SHOT_MOTION, useShotFrame, type ShotMotionOptions } from './useShotFrame';
import { VisualTrack } from './VisualTrack';
import { framesForBeat } from '../lib/duration';
import { BeatBackground } from './BeatBackground';

export const BrollBeat: React.FC<{
  beat: BrollBeatData;
  fps: number;
  /** Shot-engine options from BeatSequence; bakeoff tooling falls back to DEFAULT_SHOT_MOTION. */
  motion?: ShotMotionOptions;
}> = ({ beat, motion }) => {
  const { shot, objectPosition, layout, smallSize } = useShotFrame(beat, motion);
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {beat.visuals?.length ? (
        <VisualTrack visuals={beat.visuals} durationInFrames={framesForBeat(beat, fps)} motion={motion ?? DEFAULT_SHOT_MOTION} variant="broll" />
      ) : (
        <BeatBackground photoUrl={beat.photo_url} objectPosition={objectPosition} shot={shot} layout={layout} smallSize={smallSize} />
      )}
      {beat.audio_url ? <Audio src={beat.audio_url} volume={MASTER_GAIN} /> : null}
    </AbsoluteFill>
  );
};
