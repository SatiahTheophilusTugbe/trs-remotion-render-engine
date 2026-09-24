import { AbsoluteFill, Audio, useCurrentFrame } from 'remotion';
import type { Beat } from '../types/beat';
import { kenBurnsScale } from '../lib/kenburns';
import { framesForBeat } from '../lib/duration';
import { BeatBackground } from './BeatBackground';

export const BrollBeat: React.FC<{ beat: Beat; fps: number }> = ({ beat, fps }) => {
  const frame = useCurrentFrame();
  const durationInFrames = framesForBeat(beat, fps);
  const scale = kenBurnsScale(frame, durationInFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground photoUrl={beat.photo_url} objectPosition="center top" scale={scale} />
      {beat.audio_url ? <Audio src={beat.audio_url} /> : null}
    </AbsoluteFill>
  );
};
