import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { WordTiming } from '../types/beat';
import { activeWordIndex, pageAt, pageWords } from '../lib/captions';
import { montserratBold } from '../lib/fonts';
import { captionFontSize, FRAME_W } from '../lib/captionPlacement';

// Design decision 1: avatar beats put captions above the 324x573 corner avatar box.
export const CAPTIONS_ON_AVATAR = true;
// Placement comes from lib/captionPlacement.ts (owner 2026-10-20): the caption hangs from just below the
// beat's photo frame and, on avatar beats, wraps left of the avatar box. It stays inside the mobile feed
// preview (owner 2026-10-18: captions at bottom 220 were hidden until the reel was opened).
export const CaptionLayer: React.FC<{ words: WordTiming[]; placement: { top: number; left: number; right: number } }> = ({
  words,
  placement,
}) => {
  const frame = useCurrentFrame(); // local to the enclosing <Sequence>
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const page = pageAt(pageWords(words), t);
  if (!page) return null;
  const active = activeWordIndex(page, t);
  const fontSize = captionFontSize(page.map((w) => w.word), FRAME_W - placement.left - placement.right);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: placement.left,
          right: placement.right,
          top: placement.top,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px 22px',
        }}
      >
        {page.map((w, i) => (
          <span
            key={`${w.start}-${i}`}
            style={{
              fontFamily: montserratBold,
              fontSize,
              fontWeight: 700,
              lineHeight: 1.15,
              color: i === active ? '#CCFF00' : '#FFFFFF',
              WebkitTextStroke: '3px rgba(0,0,0,0.8)',
              paintOrder: 'stroke fill',
            }}
          >
            {w.word}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
