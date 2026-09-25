// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
// Technique ported from RenderComp free-remotion-templates LowerThirdGlassCard (MIT, Trimora Inc.):
// spring slide-in, frosted glass body (translucent gradient + 1px hairline + backdrop blur),
// inner accent glow with a sin-driven pulse, top sheen, left accent bar with glow, staggered
// text reveal. Adapted to portrait 1080x1920, TRS lime accent, Montserrat, clamped headline.
// Placement: bottom edge at y=1400, i.e. clear of the top brand badges (y<70) and above the
// caption zone (captions sit at bottom:220, <=~3 lines => top of zone ~y=1460).
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { montserratBold } from '../lib/fonts';
import { LIME } from './shared';

export const GLASS_MAX_SECONDS = 4;
const CARD_LEFT = 60;
const CARD_W = 960;
const CARD_BOTTOM = 520;

export const GlassLowerThird: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exitStart = GLASS_MAX_SECONDS * fps - 12;
  if (frame >= GLASS_MAX_SECONDS * fps) return null;

  const cardIn = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 90 }, durationInFrames: 28 });
  const textIn = spring({ frame: frame - 16, fps, config: { damping: 16, stiffness: 110 }, durationInFrames: 22 });
  const exit = interpolate(frame, [exitStart, GLASS_MAX_SECONDS * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const glowPulse = 0.5 + 0.5 * Math.sin(frame * 0.08);
  const slideX = (1 - cardIn) * -(CARD_W + CARD_LEFT) - exit * (CARD_W + CARD_LEFT);
  const opacity = Math.min(1, cardIn * 1.5) * (1 - exit);

  return (
    <div
      style={{
        position: 'absolute',
        left: CARD_LEFT,
        bottom: CARD_BOTTOM,
        width: CARD_W,
        opacity,
        transform: `translateX(${slideX}px)`,
      }}
    >
      <div
        style={{
          position: 'relative',
          borderRadius: 32,
          padding: '40px 48px 40px 64px',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.06) 100%), rgba(10,10,10,0.38)',
          border: '1px solid rgba(255,255,255,0.28)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          boxShadow: '0 28px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '-12%',
            top: '-60%',
            width: '55%',
            height: '220%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${LIME}55 0%, transparent 70%)`,
            opacity: 0.35 + glowPulse * 0.35,
            filter: 'blur(10px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '40%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, transparent 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 26,
            top: '16%',
            width: 8,
            height: '68%',
            borderRadius: 99,
            backgroundColor: LIME,
            boxShadow: `0 0 28px ${LIME}`,
          }}
        />
        <p
          style={{
            position: 'relative',
            margin: 0,
            color: '#FFFFFF',
            fontFamily: montserratBold,
            fontSize: 54,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '0.01em',
            opacity: textIn,
            transform: `translateY(${(1 - textIn) * 14}px)`,
            textShadow: '0 2px 14px rgba(0,0,0,0.55)',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 3,
            overflow: 'hidden',
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
};
