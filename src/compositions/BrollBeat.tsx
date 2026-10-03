import { AbsoluteFill, Audio } from 'remotion';
import type { BrollBeatData } from '../types/beat';
import { useShotFrame, type ShotMotionOptions } from './useShotFrame';
import { BeatBackground } from './BeatBackground';

export const BrollBeat: React.FC<{
  beat: BrollBeatData;
  fps: number;
  /** Shot-engine options from BeatSequence; bakeoff tooling falls back to DEFAULT_SHOT_MOTION. */
  motion?: ShotMotionOptions;
}> = ({ beat, motion }) => {
  const { shot, objectPosition } = useShotFrame(beat, motion);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground photoUrl={beat.photo_url} objectPosition={objectPosition} shot={shot} />
      {beat.audio_url ? <Audio src={beat.audio_url} /> : null}
    </AbsoluteFill>
  );
};
