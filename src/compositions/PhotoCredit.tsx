import { AbsoluteFill } from 'remotion';
import { montserratBold } from '../lib/fonts';

// Small on-screen source credit, shown while its photo is on screen (owner, 2026-10-03), so the
// published captions no longer need a long "Photos:" line. Left side, just above the captions
// (owner): captions start at bottom 220 (broll) / 640 (avatar) and run up to two 60px lines, so the
// credit sits above that block, clear of the platforms' bottom-left overlay and right-hand rail.
export const CREDIT_BOTTOM = { broll: 430, avatar: 820 } as const;

export const PhotoCredit: React.FC<{ credit: string; variant: 'avatar' | 'broll' }> = ({ credit, variant }) => (
  <AbsoluteFill>
    <p
      style={{
        position: 'absolute',
        left: 60,
        bottom: CREDIT_BOTTOM[variant],
        maxWidth: 640,
        margin: 0,
        fontFamily: montserratBold,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: '0.5px',
        color: 'rgba(255,255,255,0.8)',
        textShadow: '0 1px 6px rgba(0,0,0,0.95)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      Photo: {credit}
    </p>
  </AbsoluteFill>
);
