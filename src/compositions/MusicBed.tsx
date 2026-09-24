import { Audio, useVideoConfig } from 'remotion';
import { musicVolume } from '../lib/music';

export const MusicBed: React.FC<{ src: string }> = ({ src }) => {
  const { fps, durationInFrames } = useVideoConfig();
  return <Audio src={src} loop loopVolumeCurveBehavior="extend" volume={(f) => musicVolume(f, durationInFrames, fps)} />;
};
