// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
// Technique ported from RenderComp free-remotion-templates KpiCounter (MIT, Trimora Inc.):
// mechanical odometer drums (ones wheel spins continuously; higher wheels only turn as the
// wheel below rolls 9 -> 0, so digits lock one column at a time), out-cubic count-up, accent
// bar that draws in, spring entrance, fixed digit template (readout never changes width).
// Adapted to portrait 1080x1920, TRS lime glow + underline, Montserrat. Production changes over
// the prototype: the whole formatted value (prefix+number+suffix) is auto-fitted into the card,
// leading-zero columns are hidden (no "03.3"), a semi-opaque dark backing panel with a lime
// border keeps mid-roll digits legible over busy photos, and the count-up runs in
// COUNT_UP_SECONDS (<= 1.2s) landing exactly on the target.
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { StatData } from '../types/beat';
import { COUNT_UP_SECONDS, columnVisibility, countUpValue, formatStat, odometerUnits, wheelPos } from '../lib/stat';
import {
  AFFIX_GAP_EM,
  AFFIX_RATIO,
  DIGIT_EM,
  LABEL_MAX_CHARS,
  LABEL_TRACKING_EM,
  SEP_EM,
  STAT_BORDER,
  STAT_INNER_W,
  STAT_MAX_FONT,
  STAT_MIN_FONT,
  STAT_PAD_X,
  STAT_PANEL_MAX_W,
  fitLabel,
  fitStatFontSize,
  leadingHiddenEm,
} from '../lib/statFit';
import { montserratBold } from '../lib/fonts';

const LIME = '#CCFF00';
const DIGIT_CELL_RATIO = 1.2;
const DRUM_MASK = 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)';

const DigitDrum: React.FC<{ pos: number; fontSize: number; visible: boolean }> = ({
  pos,
  fontSize,
  visible,
}) => {
  const cell = fontSize * DIGIT_CELL_RATIO;
  const wheel = ((pos % 10) + 10) % 10;
  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
        width: fontSize * DIGIT_EM,
        height: cell,
        opacity: visible ? 1 : 0,
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

const RollingNumber: React.FC<{ progress: number; target: number; decimals: number; fontSize: number }> = ({
  progress,
  target,
  decimals,
  fontSize,
}) => {
  const template = formatStat(target, decimals);
  const digitCount = template.replace(/[^0-9]/g, '').length;
  const units = odometerUnits(target, decimals, progress);
  const visibility = columnVisibility(template, units, decimals);
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
                width: fontSize * SEP_EM,
                textAlign: 'center',
                color: LIME,
                opacity: visibility[i] ? 1 : 0,
              }}
            >
              {ch}
            </span>
          );
        }
        const place = digitCount - 1 - digitIndex;
        digitIndex += 1;
        return <DigitDrum key={`d-${i}`} pos={wheelPos(units, place)} fontSize={fontSize} visible={visibility[i]} />;
      })}
    </span>
  );
};

// Overlay only (dim, glow, backing panel, odometer, underline, label). The beat photo (Ken Burns)
// and narration audio belong to StatRevealBeat.
export const OdometerStat: React.FC<{ stat: StatData }> = ({ stat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { value, prefix = '', suffix = '', decimals = 0 } = stat;
  const label = (stat.label ?? '').trim().slice(0, LABEL_MAX_CHARS);

  const number = formatStat(value, decimals);
  const fontSize = fitStatFontSize(number, prefix, suffix, STAT_INNER_W, STAT_MAX_FONT, STAT_MIN_FONT);
  const affixSize = fontSize * AFFIX_RATIO;
  const affixGap = Math.round(fontSize * AFFIX_GAP_EM);
  const labelFit = fitLabel(label, STAT_INNER_W);
  const template = number;

  // Count-up: out-cubic, exactly COUNT_UP_SECONDS long, exactly 1 at the end.
  const progress = countUpValue(frame, fps, 1, COUNT_UP_SECONDS);
  const cardIn = spring({ frame, fps, config: { damping: 14, stiffness: 120, mass: 0.8 }, durationInFrames: 16 });
  const lineProgress = interpolate(frame, [0, Math.round(COUNT_UP_SECONDS * fps) + 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const labelIn = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  // Prefix hugs the first VISIBLE digit: slide it over the hidden leading-zero columns.
  const prefixShift =
    fontSize *
    leadingHiddenEm(template, columnVisibility(template, odometerUnits(value, decimals, progress), decimals));
  const glow = 0.55 + 0.25 * Math.sin(frame * 0.09);

  return (
    <>
      <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 44%, rgba(204,255,0,${0.16 * glow}) 0%, transparent 60%)`,
        }}
      />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 260 }}>
        <div
          style={{
            opacity: Math.min(1, cardIn * 2),
            transform: `translateY(${(1 - cardIn) * 40}px) scale(${0.94 + 0.06 * cardIn})`,
            boxSizing: 'border-box',
            maxWidth: STAT_PANEL_MAX_W,
            padding: `44px ${STAT_PAD_X}px 46px`,
            background: 'rgba(6,6,6,0.74)',
            border: `${STAT_BORDER}px solid ${LIME}`,
            borderRadius: 28,
            boxShadow: `0 0 ${36 * glow}px rgba(204,255,0,${0.28 * glow})`,
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
              fontSize,
              lineHeight: 1,
              color: LIME,
              whiteSpace: 'nowrap',
              filter: `drop-shadow(0 0 ${22 * glow}px rgba(204,255,0,0.5))`,
            }}
          >
            {prefix ? (
              <span
                style={{
                  fontSize: affixSize,
                  marginRight: affixGap,
                  whiteSpace: 'pre',
                  transform: `translateX(${prefixShift}px)`,
                }}
              >
                {prefix}
              </span>
            ) : null}
            <RollingNumber progress={progress} target={value} decimals={decimals} fontSize={fontSize} />
            {suffix ? (
              <span style={{ fontSize: affixSize, marginLeft: affixGap, whiteSpace: 'pre' }}>{suffix}</span>
            ) : null}
          </div>
          <div
            style={{
              margin: '8px auto 0',
              width: '100%',
              height: 8,
              borderRadius: 8,
              backgroundColor: LIME,
              transform: `scaleX(${lineProgress})`,
              boxShadow: `0 0 26px 4px rgba(204,255,0,${0.55 * glow})`,
            }}
          />
          {label ? (
            <div
              style={{
                marginTop: 30,
                maxWidth: STAT_INNER_W,
                fontSize: labelFit.fontSize,
                lineHeight: 1.15,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: `${LABEL_TRACKING_EM}em`,
                textWrap: 'balance',
                opacity: labelIn,
                transform: `translateY(${(1 - labelIn) * 18}px)`,
                textShadow: '0 2px 14px rgba(0,0,0,0.6)',
              }}
            >
              {label}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </>
  );
};
