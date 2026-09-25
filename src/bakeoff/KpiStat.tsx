// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
// Technique ported from RenderComp free-remotion-templates KpiCounter (MIT, Trimora Inc.):
// mechanical odometer drums (ones wheel spins continuously; higher wheels only turn as the
// wheel below rolls 9 -> 0, so digits lock one column at a time), out-cubic count-up, accent
// bar that draws in, spring entrance, fixed digit template (readout never changes width).
// Adapted to portrait 1080x1920, TRS lime glow + underline, Montserrat, dimmed beat photo.
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { StatBeatData } from '../types/beat';
import { BeatBackground } from '../compositions/BeatBackground';
import { kenBurnsScale } from '../lib/kenburns';
import { framesForBeat } from '../lib/duration';
import { montserratBold } from '../lib/fonts';
import { LIME } from './shared';

const DIGIT_CELL_RATIO = 1.2;
const DIGIT_WIDTH_RATIO = 0.66;
const DRUM_MASK = 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)';
const NUMBER_SIZE = 230;
const COUNT_START = 8;
const COUNT_END = 8 + 48;

const DigitDrum: React.FC<{ pos: number; fontSize: number }> = ({ pos, fontSize }) => {
  const cell = fontSize * DIGIT_CELL_RATIO;
  const wheel = ((pos % 10) + 10) % 10;
  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
        width: fontSize * DIGIT_WIDTH_RATIO,
        height: cell,
        maskImage: DRUM_MASK,
        WebkitMaskImage: DRUM_MASK,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${-wheel * cell}px)`,
        }}
      >
        {Array.from({ length: 11 }, (_, i) => (
          <span
            key={i}
            style={{
              display: 'block',
              height: cell,
              lineHeight: `${cell}px`,
              textAlign: 'center',
              color: LIME,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {i % 10}
          </span>
        ))}
      </span>
    </span>
  );
};

// Wheel position for the digit at decimal place p (value in smallest displayed unit).
const wheelPos = (value: number, p: number): number => {
  const q = Math.max(0, value) / 10 ** p;
  const whole = Math.floor(q);
  const frac = q - whole;
  const carry = p === 0 ? frac : Math.min(1, Math.max(0, frac * 10 - 9));
  return (whole % 10) + carry;
};

const RollingNumber: React.FC<{ progress: number; target: number; decimals: number; fontSize: number }> = ({
  progress,
  target,
  decimals,
  fontSize,
}) => {
  const units = Math.round(target * 10 ** decimals);
  const template = target.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const digitCount = template.replace(/[^0-9]/g, '').length;
  const value = units * progress;
  const cell = fontSize * DIGIT_CELL_RATIO;
  let digitIndex = 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {template.split('').map((ch, i) => {
        if (ch < '0' || ch > '9') {
          return (
            <span
              key={`s-${i}`}
              style={{
                display: 'inline-block',
                height: cell,
                lineHeight: `${cell}px`,
                width: fontSize * 0.28,
                textAlign: 'center',
                color: LIME,
              }}
            >
              {ch}
            </span>
          );
        }
        const place = digitCount - 1 - digitIndex;
        digitIndex += 1;
        // place counts digits from the right, but the smallest unit is 10^-decimals
        return <DigitDrum key={`d-${i}`} pos={wheelPos(value, place)} fontSize={fontSize} />;
      })}
    </span>
  );
};

export const KpiStat: React.FC<{ beat: StatBeatData }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = framesForBeat(beat, fps);
  const { value, label, prefix = '', suffix = '', decimals = 0 } = beat.stat;

  const progress = interpolate(frame, [COUNT_START, COUNT_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const cardIn = spring({ frame, fps, config: { damping: 14, stiffness: 90, mass: 0.9 }, durationInFrames: 24 });
  const lineProgress = interpolate(frame, [COUNT_START, COUNT_END + 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const labelIn = interpolate(frame, [22, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const glow = 0.55 + 0.25 * Math.sin(frame * 0.09);
  const small = NUMBER_SIZE * 0.5;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground
        photoUrl={beat.photo_url}
        objectPosition="center top"
        scale={kenBurnsScale(frame, durationInFrames)}
      />
      <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.62)' }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 42%, rgba(204,255,0,${0.16 * glow}) 0%, transparent 60%)`,
        }}
      />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 260 }}>
        <div
          style={{
            opacity: Math.min(1, cardIn * 1.5),
            transform: `translateY(${(1 - cardIn) * 40}px) scale(${0.94 + 0.06 * cardIn})`,
            textAlign: 'center',
            fontFamily: montserratBold,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: NUMBER_SIZE,
              lineHeight: 1,
              color: LIME,
              whiteSpace: 'nowrap',
              filter: `drop-shadow(0 0 ${28 * glow}px rgba(204,255,0,0.55))`,
            }}
          >
            {prefix ? <span style={{ fontSize: small, marginRight: 8 }}>{prefix}</span> : null}
            <RollingNumber progress={progress} target={value} decimals={decimals} fontSize={NUMBER_SIZE} />
            {suffix ? <span style={{ fontSize: small, marginLeft: 8, whiteSpace: 'pre' }}>{suffix}</span> : null}
          </div>
          <div
            style={{
              margin: '10px auto 0',
              width: 760,
              height: 8,
              borderRadius: 8,
              backgroundColor: LIME,
              transform: `scaleX(${lineProgress})`,
              boxShadow: `0 0 26px 4px rgba(204,255,0,${0.55 * glow})`,
            }}
          />
          <div
            style={{
              marginTop: 34,
              fontSize: 56,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: 6,
              opacity: labelIn,
              transform: `translateY(${(1 - labelIn) * 18}px)`,
              textShadow: '0 2px 14px rgba(0,0,0,0.6)',
            }}
          >
            {label}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
