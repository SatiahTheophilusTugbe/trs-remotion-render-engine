import { useCurrentFrame, useVideoConfig } from 'remotion';
import { montserratBold } from '../lib/fonts';
// Bake-off baseline (B1): the pre-G4b production banner, kept only so the owner can re-compare.
// Production no longer imports this; see src/compositions/GlassBanner.tsx.

export const BANNER_MAX_SECONDS = 4;
export const BANNER_TOP = 90; // design decision 3: below the corner-badge row

export const OverlayBanner: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame >= BANNER_MAX_SECONDS * fps) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: BANNER_TOP,
        left: 0,
        width: 1080,
        padding: 30,
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: 0,
          color: '#FFFFFF',
          fontFamily: montserratBold,
          fontSize: 64,
          fontWeight: 700,
          background: 'rgba(0,0,0,0.55)',
          padding: 20,
          borderRadius: 16,
        }}
      >
        {text}
      </p>
    </div>
  );
};
