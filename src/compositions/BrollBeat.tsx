import { AbsoluteFill, Audio, useCurrentFrame } from 'remotion';
import type { Beat } from '../types/beat';
import { kenBurnsScale } from '../lib/kenburns';
import { framesForBeat } from '../lib/duration';
import { montserratBold } from '../lib/fonts';
import { BeatBackground } from './BeatBackground';

export const BrollBeat: React.FC<{ beat: Beat; fps: number }> = ({ beat, fps }) => {
  const frame = useCurrentFrame();
  const durationInFrames = framesForBeat(beat, fps);
  const scale = kenBurnsScale(frame, durationInFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground photoUrl={beat.photo_url} objectPosition="center top" scale={scale} />
      {beat.overlay_text ? (
        <div
          style={{
            position: 'absolute',
            left: 60,
            right: 60,
            bottom: 220,
            textAlign: 'center',
          }}
        >
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
      ) : null}
      {beat.audio_url ? <Audio src={beat.audio_url} /> : null}
    </AbsoluteFill>
  );
};
