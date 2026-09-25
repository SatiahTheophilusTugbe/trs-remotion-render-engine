// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
// Idea ported from RenderComp free-remotion-templates ParallaxPan (MIT, Trimora Inc.): layers
// travel at different speeds (smaller factor = further away) to create depth. With a single
// still photo the "layers" are: (1) a blurred, darkened, scaled copy of the photo drifting
// slowly one way, (2) a floating foreground card drifting/tilting the other way, (3) the photo
// inside the card panning and slowly pushing in at a third speed, plus a soft vignette.
// Pure 2D transforms only (no perspective) so there are no fake-3D warping artifacts.
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const CARD = { left: 60, top: 110, width: 960, height: 1640, radius: 28 };

export const ParallaxPhoto: React.FC<{ photoUrl: string | null }> = ({ photoUrl }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  if (!photoUrl) return <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }} />;

  const bgX = interpolate(t, [0, 1], [30, -30]);
  const bgScale = interpolate(t, [0, 1], [1.32, 1.4]);
  const cardX = interpolate(t, [0, 1], [-22, 22]);
  const cardY = interpolate(t, [0, 1], [8, -8]);
  const cardRot = interpolate(t, [0, 1], [-0.5, 0.5]);
  const innerX = interpolate(t, [0, 1], [26, -26]);
  const innerScale = interpolate(t, [0, 1], [1.1, 1.2]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
      <Img
        src={photoUrl}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
          filter: 'blur(34px) brightness(0.42) saturate(1.15)',
          transform: `translateX(${bgX}px) scale(${bgScale})`,
        }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />
      <div
        style={{
          position: 'absolute',
          left: CARD.left,
          top: CARD.top,
          width: CARD.width,
          height: CARD.height,
          borderRadius: CARD.radius,
          overflow: 'hidden',
          boxShadow: '0 40px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.12)',
          transform: `translate(${cardX}px, ${cardY}px) rotate(${cardRot}deg)`,
        }}
      >
        <Img
          src={photoUrl}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            transform: `translateX(${innerX}px) scale(${innerScale})`,
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.45) 100%), linear-gradient(180deg, rgba(0,0,0,0.0) 70%, rgba(0,0,0,0.35) 100%)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
