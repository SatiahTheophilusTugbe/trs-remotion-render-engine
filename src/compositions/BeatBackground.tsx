import { useId } from 'react';
import { AbsoluteFill, Img } from 'remotion';
import type { ShotFrame } from '../lib/shotMotion';
import { PhotoGrade } from './PhotoGrade';

export const BeatBackground: React.FC<{
  photoUrl: string | null | undefined;
  objectPosition: string;
  shot?: ShotFrame;
  /**
   * @deprecated Superseded by `shot`. Retained only so the src/bakeoff/ prototype
   * tooling (out of scope for this task) keeps compiling/rendering unchanged.
   */
  scale?: number;
}> = ({ photoUrl, objectPosition, shot, scale }) => {
  const filterId = 'shot-blur-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!photoUrl) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#0a0a0a',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            color: '#222',
            fontSize: 420,
            fontWeight: 900,
            fontFamily: 'Arial, sans-serif',
            opacity: 0.5,
          }}
        >
          TRS
        </p>
      </AbsoluteFill>
    );
  }
  const blurred = !!shot && (shot.blurX > 0.4 || shot.blurY > 0.4);
  return (
    <PhotoGrade>
      {blurred ? (
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={`${(shot?.blurX ?? 0).toFixed(2)} ${(shot?.blurY ?? 0).toFixed(2)}`} />
          </filter>
        </svg>
      ) : null}
      <Img
        src={photoUrl}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition,
          filter: blurred ? `url(#${filterId})` : undefined,
          transform: shot
            ? `translate(${shot.txPct.toFixed(3)}%, ${shot.tyPct.toFixed(3)}%) scale(${shot.scale.toFixed(4)})`
            : scale !== undefined
              ? `scale(${scale})`
              : undefined,
        }}
      />
    </PhotoGrade>
  );
};
