import { AbsoluteFill, OffthreadVideo } from 'remotion';
import type { AvatarBeatData } from '../types/beat';
import { BeatBackground } from './BeatBackground';
import { PhotoGrade } from './PhotoGrade';
import { useShotFrame, type ShotMotionOptions } from './useShotFrame';

export const AvatarBeat: React.FC<{
  beat: AvatarBeatData;
  /** Shot-engine options from BeatSequence; bakeoff tooling falls back to DEFAULT_SHOT_MOTION. */
  motion?: ShotMotionOptions;
}> = ({ beat, motion }) => {
  const { shot, objectPosition } = useShotFrame(beat, motion);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground photoUrl={beat.photo_url} objectPosition={objectPosition} shot={shot} />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 320,
          height: 569,
          border: '2px solid #CCFF00',
          borderRadius: '12px 0 0 0',
          overflow: 'hidden',
          WebkitMaskImage:
            'linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.35) 8%, #000 22%, #000 100%)',
          maskImage:
            'linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.35) 8%, #000 22%, #000 100%)',
        }}
      >
        <PhotoGrade width={320} vignette={false}>
          <OffthreadVideo
            src={beat.clip_url}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </PhotoGrade>
      </div>
    </AbsoluteFill>
  );
};
