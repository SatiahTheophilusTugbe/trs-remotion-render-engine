import { useId } from 'react';
import { AbsoluteFill, Img } from 'remotion';
import type { ShotFrame } from '../lib/shotMotion';
import type { PhotoLayout } from '../lib/shots';
import { PhotoGrade } from './PhotoGrade';

export const BeatBackground: React.FC<{
  photoUrl: string | null | undefined;
  objectPosition: string;
  shot?: ShotFrame;
  /** 'letterbox' = whole photo over a blurred copy (group photos); default full-bleed cover. */
  layout?: PhotoLayout;
  /** Pixel size of the photo card when layout is 'small'. */
  smallSize?: { width: number; height: number } | null;
  /**
   * @deprecated Superseded by `shot`. Retained only so the src/bakeoff/ prototype
   * tooling (out of scope for this task) keeps compiling/rendering unchanged.
   */
  scale?: number;
}> = ({ photoUrl, objectPosition, shot, layout = 'cover', smallSize, scale }) => {
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
  const blurFilter = blurred ? (
    <svg width={0} height={0} style={{ position: 'absolute' }}>
      <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={`${(shot?.blurX ?? 0).toFixed(2)} ${(shot?.blurY ?? 0).toFixed(2)}`} />
      </filter>
    </svg>
  ) : null;
  if (layout === 'small' && smallSize) {
    // Small photo: shown whole at a capped size as a framed card over a blurred, darkened copy, so a
    // low-resolution upload never gets blown up into an extreme close-up. Motion damped like letterbox.
    const k = 0.4;
    const fg = shot
      ? `translate(${(shot.txPct * k).toFixed(3)}%, ${(shot.tyPct * k).toFixed(3)}%) scale(${(1 + (shot.scale - 1) * k).toFixed(4)})`
      : undefined;
    return (
      <PhotoGrade>
        {blurFilter}
        <Img
          src={photoUrl}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover',
            filter: 'blur(40px) brightness(0.5)', transform: 'scale(1.15)',
          }}
        />
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Img
            src={photoUrl}
            style={{
              width: smallSize.width, height: smallSize.height, objectFit: 'cover', borderRadius: 24,
              boxShadow: '0 30px 90px rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.18)',
              filter: blurred ? `url(#${filterId})` : undefined, transform: fg,
            }}
          />
        </AbsoluteFill>
      </PhotoGrade>
    );
  }
  if (layout === 'letterbox') {
    // Group photos: the WHOLE photo across the frame width, centred, over a still, blurred, darkened
    // full-bleed copy. The shot motion is damped on the foreground so the move never cuts the group.
    const k = 0.4;
    const fg = shot
      ? `translate(${(shot.txPct * k).toFixed(3)}%, ${(shot.tyPct * k).toFixed(3)}%) scale(${(1 + (shot.scale - 1) * k).toFixed(4)})`
      : undefined;
    return (
      <PhotoGrade>
        {blurFilter}
        <Img
          src={photoUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(40px) brightness(0.55)',
            transform: 'scale(1.15)',
          }}
        />
        <Img
          src={photoUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            filter: blurred ? `url(#${filterId})` : undefined,
            transform: fg,
          }}
        />
      </PhotoGrade>
    );
  }
  return (
    <PhotoGrade>
      {blurFilter}
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
