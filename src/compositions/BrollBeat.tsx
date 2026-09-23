import { AbsoluteFill, Audio, Img, useCurrentFrame } from 'remotion';
import type { Beat } from '../types/beat';
import { kenBurnsScale } from '../lib/kenburns';
import { montserratBold } from '../lib/fonts';

export const BrollBeat: React.FC<{ beat: Beat; fps: number }> = ({ beat, fps }) => {
  const frame = useCurrentFrame();
  const durationInFrames = Math.round(beat.duration_sec * fps);
  const scale = kenBurnsScale(frame, durationInFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <Img
        src={beat.photo_url}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          transform: `scale(${scale})`,
        }}
      />
      <div style={{ position: 'absolute', left: 60, right: 60, bottom: 220, textAlign: 'center' }}>
        <span
          style={{
            fontFamily: montserratBold,
            fontSize: 60,
            fontWeight: 700,
            lineHeight: 1.15,
            color: '#FFFFFF',
            WebkitTextStroke: '3px #000000',
            paintOrder: 'stroke fill',
          }}
        >
          {beat.overlay_text}
        </span>
      </div>
      {beat.audio_url ? <Audio src={beat.audio_url} /> : null}
    </AbsoluteFill>
  );
};
