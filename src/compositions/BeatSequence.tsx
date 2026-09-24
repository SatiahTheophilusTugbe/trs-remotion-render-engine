import { AbsoluteFill, Sequence } from 'remotion';
import type { Beat } from '../types/beat';
import { AvatarBeat } from './AvatarBeat';
import { BrollBeat } from './BrollBeat';
import { framesForBeat } from '../lib/duration';

const renderBeat = (beat: Beat, fps: number) => {
  switch (beat.type) {
    case 'avatar':
      return <AvatarBeat beat={beat} />;
    case 'broll':
      return <BrollBeat beat={beat} fps={fps} />;
    default: {
      const unreachable: never = beat.type;
      throw new Error(`Unknown beat type: ${String(unreachable)}`);
    }
  }
};

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
            {renderBeat(beat, fps)}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
