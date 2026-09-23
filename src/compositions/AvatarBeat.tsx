import { AbsoluteFill, Img, OffthreadVideo } from 'remotion';
import type { Beat } from '../types/beat';

export const AvatarBeat: React.FC<{ beat: Beat }> = ({ beat }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <Img
        src={beat.photo_url}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
        }}
      />
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
        <OffthreadVideo
          src={beat.clip_url!}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </AbsoluteFill>
  );
};
