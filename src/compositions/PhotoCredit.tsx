import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { montserratBold } from '../lib/fonts';
import { creditProgress } from '../lib/creditMotion';

// Small on-screen source credit, shown while its photo is on screen (owner, 2026-10-03), so the
// published captions no longer need a long "Photos:" line. Left side, just above the captions
// (owner): captions start at bottom 220 (broll) / 640 (avatar) and run up to two 60px lines, so the
// credit sits above that block, clear of the platforms' bottom-left overlay and right-hand rail.
// It slides in from the left after the photo lands and back out the same way before it leaves.
export const CREDIT_BOTTOM = { broll: 430, avatar: 820 } as const;
const OFFSCREEN_X = -760; // further left than the widest credit (maxWidth 640 + left 60)

export const PhotoCredit: React.FC<{ credit: string; variant: 'avatar' | 'broll'; durationInFrames: number }> = ({
  credit,
  variant,
  durationInFrames,
}) => {
  const frame = useCurrentFrame(); // local to the beat's <Sequence>
  const { fps } = useVideoConfig();
  const p = creditProgress(frame, durationInFrames, fps);
  if (p <= 0) return null;
  return (
    <AbsoluteFill>
      <p
        style={{
          position: 'absolute',
          left: 60,
          bottom: CREDIT_BOTTOM[variant],
          maxWidth: 640,
          margin: 0,
          transform: `translateX(${(1 - p) * OFFSCREEN_X}px)`,
          opacity: p,
          // Always legible whatever the photo (owner): a dark pill guarantees >= 5.8:1 contrast for
          // the white text even over a pure-white image; lime edge = brand accent (#CCFF00).
          padding: '8px 16px 8px 14px',
          background: 'rgba(0,0,0,0.6)',
          borderLeft: '4px solid #CCFF00',
          borderRadius: 6,
          boxSizing: 'border-box',
          fontFamily: montserratBold,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '0.5px',
          color: '#FFFFFF',
          textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        Photo: {credit}
      </p>
    </AbsoluteFill>
  );
};
