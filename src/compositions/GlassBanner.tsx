// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
// Technique ported from RenderComp free-remotion-templates LowerThirdGlassCard (MIT, Trimora Inc.):
// spring slide-in, frosted glass body (translucent gradient + 1px hairline + backdrop blur),
// inner accent glow with a sin-driven pulse, top sheen, left accent bar with glow, staggered
// text reveal. Adapted to portrait 1080x1920, TRS lime accent, Montserrat, auto-fitted headline.
// Placement: TOP of the frame, just below the brand-badge row (badges occupy y 0..~60). Card height
// is bounded (<= 420px, see lib/glassBanner.ts) so it never reaches the vertical middle, the
// captions (bottom:220) or the avatar corner box.
// The card is dark enough to read WITHOUT backdrop-filter (semi-opaque glass gradient + border +
// sheen), so it degrades safely if a renderer ignores backdrop-filter.
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { montserratBold } from '../lib/fonts';
import {
  GLASS_CARD_W,
  GLASS_LINE_HEIGHT,
  GLASS_MAX_LINES,
  glassLayout,
} from '../lib/glassBanner';

export const BANNER_MAX_SECONDS = 4;
export const BANNER_TOP = 100; // just below the brand-badge row (badges: y 0..~60)
const CARD_LEFT = 60;
const LIME = '#CCFF00';

export const GlassBanner: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const endFrame = BANNER_MAX_SECONDS * fps;
  if (frame >= endFrame) return null;
  const exitStart = endFrame - 12;
  const { fontSize } = glassLayout(text);

  const cardIn = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 90 }, durationInFrames: 28 });
  const textIn = spring({ frame: frame - 16, fps, config: { damping: 16, stiffness: 110 }, durationInFrames: 22 });
  const exit = interpolate(frame, [exitStart, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const glowPulse = 0.5 + 0.5 * Math.sin(frame * 0.08);
  const slideX = (1 - cardIn) * -(GLASS_CARD_W + CARD_LEFT) - exit * (GLASS_CARD_W + CARD_LEFT);
  const opacity = Math.min(1, cardIn * 1.5) * (1 - exit);

  return (
    <div
      style={{
        position: 'absolute',
        left: CARD_LEFT,
        top: BANNER_TOP,
        width: GLASS_CARD_W,
        boxSizing: 'border-box',
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
            'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 100%), rgba(10,10,10,0.62)',
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
            opacity: 0.3 + glowPulse * 0.3,
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
            fontSize,
            fontWeight: 700,
            lineHeight: GLASS_LINE_HEIGHT,
            letterSpacing: '0.01em',
            opacity: textIn,
            transform: `translateY(${(1 - textIn) * 14}px)`,
            textShadow: '0 2px 14px rgba(0,0,0,0.55)',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: GLASS_MAX_LINES,
            overflow: 'hidden',
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
};
