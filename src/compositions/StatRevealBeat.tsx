import { AbsoluteFill, Audio } from 'remotion';
import type { StatBeatData } from '../types/beat';
import { BeatBackground } from './BeatBackground';
import { OdometerStat } from './OdometerStat';
import { useShotFrame, type ShotMotionOptions } from './useShotFrame';

export const StatRevealBeat: React.FC<{
  beat: StatBeatData;
  /** Shot-engine options from BeatSequence; bakeoff tooling falls back to DEFAULT_SHOT_MOTION. */
  motion?: ShotMotionOptions;
}> = ({ beat, motion }) => {
  const { shot, objectPosition } = useShotFrame(beat, motion);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground
        photoUrl={beat.photo_url}
        objectPosition={objectPosition}
        shot={shot}
      />
      <OdometerStat stat={beat.stat} />
      {beat.audio_url ? <Audio src={beat.audio_url} /> : null}
    </AbsoluteFill>
  );
};
