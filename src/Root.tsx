import { Composition } from 'remotion';
import { TrivialBeatDemo, TrivialBeat } from './compositions/TrivialBeatDemo';
import { AvatarBeat } from './compositions/AvatarBeat';
import type { Beat } from './types/beat';
import { framesForBeats } from './lib/duration';

const FPS = 30;

const defaultBeats: TrivialBeat[] = [
  { beat_index: 0, overlay_text: 'Intro beat', duration_sec: 3 },
  { beat_index: 1, overlay_text: 'Middle beat', duration_sec: 4 },
  { beat_index: 2, overlay_text: 'Closing beat', duration_sec: 2 },
];

const avatarSmokeBeat: Beat = {
  type: 'avatar',
  photo_url:
    'https://www.aljazeera.com/wp-content/uploads/2026/08/AFP__20260826__C6KX2G4__v2__MidRes__FblEspLigaRealMadridRealSociedad-1787778745.jpg?resize=770%2C513&quality=80',
  clip_url: 'https://vjs.zencdn.net/v/oceans.mp4',
  overlay_text: '',
  narration_line: '',
  duration_sec: 5,
  beat_index: 0,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
      <Composition
        id="AvatarBeatSmoke"
        component={() => <AvatarBeat beat={avatarSmokeBeat} />}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={150}
      />
    </>
  );
};
