import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { WordTiming } from '../types/beat';
import { activeWordIndex, pageAt, pageWords } from '../lib/captions';
import { montserratBold } from '../lib/fonts';

// Design decision 1: avatar beats put captions above the 324x573 corner avatar box.
export const CAPTIONS_ON_AVATAR = true;
export const CAPTION_BOTTOM = { broll: 220, avatar: 640 } as const;

export const CaptionLayer: React.FC<{ words: WordTiming[]; variant: 'avatar' | 'broll' }> = ({
  words,
  variant,
}) => {
  const frame = useCurrentFrame(); // local to the enclosing <Sequence>
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const page = pageAt(pageWords(words), t);
  if (!page) return null;
  const active = activeWordIndex(page, t);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          bottom: CAPTION_BOTTOM[variant],
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
              fontSize: 60,
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
