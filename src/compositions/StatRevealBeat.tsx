import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { StatBeatData } from '../types/beat';
import { BeatBackground } from './BeatBackground';
import { kenBurnsScale } from '../lib/kenburns';
import { framesForBeat } from '../lib/duration';
import { countUpValue, formatStat } from '../lib/stat';
import { montserratBold } from '../lib/fonts';

export const StatRevealBeat: React.FC<{ beat: StatBeatData }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = framesForBeat(beat, fps);
  const { value, label, prefix, suffix, decimals } = beat.stat;
  const shown = countUpValue(frame, fps, value);
  const pop = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground
        photoUrl={beat.photo_url}
        objectPosition="center top"
        scale={kenBurnsScale(frame, durationInFrames)}
      />
      <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 260 }}>
        <div
          style={{
            opacity: pop,
            transform: `scale(${0.9 + 0.1 * pop})`,
            background: 'rgba(0,0,0,0.6)',
            border: '3px solid #CCFF00',
            borderRadius: 24,
            padding: '56px 72px',
            maxWidth: 900,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: montserratBold,
              fontWeight: 700,
              fontSize: 220,
              lineHeight: 1,
              color: '#CCFF00',
              whiteSpace: 'nowrap',
              fontFeatureSettings: "'tnum'",
            }}
          >
            {formatStat(shown, decimals, prefix, suffix)}
          </div>
          <div
            style={{
              fontFamily: montserratBold,
              fontWeight: 700,
              fontSize: 56,
              color: '#fff',
              marginTop: 24,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            {label}
          </div>
        </div>
      </AbsoluteFill>
      {beat.audio_url ? <Audio src={beat.audio_url} /> : null}
    </AbsoluteFill>
  );
};
