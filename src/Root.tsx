import { Composition } from 'remotion';
import { TrivialBeatDemo, TrivialBeat } from './compositions/TrivialBeatDemo';
import { framesForBeats } from './lib/duration';

const FPS = 30;

const defaultBeats: TrivialBeat[] = [
  { beat_index: 0, overlay_text: 'Intro beat', duration_sec: 3 },
  { beat_index: 1, overlay_text: 'Middle beat', duration_sec: 4 },
  { beat_index: 2, overlay_text: 'Closing beat', duration_sec: 2 },
];

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TrivialBeatDemo"
      component={TrivialBeatDemo}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={framesForBeats(defaultBeats, FPS)}
      defaultProps={{ beats: defaultBeats, fps: FPS }}
      calculateMetadata={({ props }) => ({
        durationInFrames: framesForBeats(props.beats, props.fps),
      })}
    />
  );
};
