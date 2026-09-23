import { Composition } from 'remotion';
import { BeatSequence } from './compositions/BeatSequence';
import type { Beat } from './types/beat';
import { framesForBeats } from './lib/duration';

const FPS = 30;

const defaultBeats: Beat[] = [
  {
    type: 'avatar',
    photo_url:
      'https://www.aljazeera.com/wp-content/uploads/2026/08/AFP__20260826__C6KX2G4__v2__MidRes__FblEspLigaRealMadridRealSociedad-1787778745.jpg?resize=770%2C513&quality=80',
    clip_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    overlay_text: '',
    narration_line: 'Intro beat narration placeholder.',
    duration_sec: 5,
    beat_index: 0,
  },
  {
    type: 'broll',
    photo_url:
      'https://www.aljazeera.com/wp-content/uploads/2026/08/AFP__20260826__C6KX2G4__v2__MidRes__FblEspLigaRealMadridRealSociedad-1787778745.jpg?resize=770%2C513&quality=80',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    overlay_text: 'REAL G2 BEAT ASSEMBLY PROOF',
    narration_line: 'Middle beat narration placeholder.',
    duration_sec: 4,
    beat_index: 1,
  },
  {
    type: 'avatar',
    photo_url:
      'https://www.aljazeera.com/wp-content/uploads/2026/08/AFP__20260826__C6KX2G4__v2__MidRes__FblEspLigaRealMadridRealSociedad-1787778745.jpg?resize=770%2C513&quality=80',
    clip_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    overlay_text: '',
    narration_line: 'Closing beat narration placeholder.',
    duration_sec: 5,
    beat_index: 2,
  },
];

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="BeatSequence"
      component={BeatSequence}
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
