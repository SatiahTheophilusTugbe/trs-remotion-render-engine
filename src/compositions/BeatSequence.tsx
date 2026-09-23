import { AbsoluteFill, Sequence } from 'remotion';
import type { Beat } from '../types/beat';
import { AvatarBeat } from './AvatarBeat';
import { BrollBeat } from './BrollBeat';
import { framesForBeat } from '../lib/duration';

export const BeatSequence: React.FC<{ beats: Beat[]; fps: number }> = ({ beats, fps }) => {
  let frameCursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {beats.map((beat) => {
        const durationInFrames = framesForBeat(beat, fps);
        const from = frameCursor;
        frameCursor += durationInFrames;
        return (
          <Sequence key={beat.beat_index} from={from} durationInFrames={durationInFrames}>
            {beat.type === 'avatar' ? (
              <AvatarBeat beat={beat} />
            ) : (
              <BrollBeat beat={beat} fps={fps} />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
