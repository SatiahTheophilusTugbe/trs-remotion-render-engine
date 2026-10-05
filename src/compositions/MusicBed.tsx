import { Audio, useVideoConfig } from 'remotion';
import { MASTER_GAIN, musicLevel, MUSIC_VOLUME, trackGain, type SpeechRange } from '../lib/music';

// With `speech`, the track is loudness-matched and ducked under the narration (production).
// Without it (bake-off compositions), it plays at the flat legacy level.
export const MusicBed: React.FC<{ src: string; speech?: SpeechRange[] }> = ({ src, speech }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const gain = speech ? trackGain(src) : MUSIC_VOLUME;
  return (
    <Audio
      src={src}
      loop
      loopVolumeCurveBehavior="extend"
      volume={(f) => musicLevel(f, durationInFrames, fps, gain, speech ?? null) * (speech ? MASTER_GAIN : 1)}
    />
  );
};
