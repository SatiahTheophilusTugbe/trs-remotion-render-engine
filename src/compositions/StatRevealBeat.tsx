import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig } from 'remotion';
import type { StatBeatData } from '../types/beat';
import { BeatBackground } from './BeatBackground';
import { OdometerStat } from './OdometerStat';
import { kenBurnsScale } from '../lib/kenburns';
import { framesForBeat } from '../lib/duration';

export const StatRevealBeat: React.FC<{ beat: StatBeatData }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = framesForBeat(beat, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground
        photoUrl={beat.photo_url}
        objectPosition="center top"
        scale={kenBurnsScale(frame, durationInFrames)}
      />
      <OdometerStat stat={beat.stat} />
      {beat.audio_url ? <Audio src={beat.audio_url} /> : null}
    </AbsoluteFill>
  );
};
