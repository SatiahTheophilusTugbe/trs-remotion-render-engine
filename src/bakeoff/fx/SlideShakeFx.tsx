// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
// Techniques ported from RenderComp free-remotion-templates SlideWipe (eased horizontal page
// slide over a dark backdrop, never raw black) and CameraShake (deterministic sin-hash
// pseudo-random shake vector x decay curve, plus an impact flash). MIT, Trimora Inc.
// NON-OVERLAPPING: the outgoing beat slides left over its last E_OUT frames; the incoming beat
// slides in from the right over its first E_IN frames and "lands" with a decaying camera shake
// and a short flash. Beat lengths untouched.
import { AbsoluteFill, Easing, interpolate } from 'remotion';
import { useBeatFrames } from './fx';
import type { FxProps } from './fx';
import { DARK } from '../shared';

const E_OUT = 5;
const E_IN = 4;
const SHAKE_FRAMES = 8;
const REACH = 0.4; // fraction of frame width
const W = 1080;
const AMP = 14; // px
const ROT = 0.8; // degrees

const pseudoRand = (n: number, seed: number) => {
  const v = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export const SlideShakeFx: React.FC<FxProps> = ({ children, isFirst, isLast }) => {
  const { frame, durationInFrames } = useBeatFrames();
  let x = 0;
  let shakeX = 0;
  let shakeY = 0;
  let shakeRot = 0;
  let scale = 1;
  let flash = 0;

  const kOut = frame - (durationInFrames - E_OUT);
  if (!isLast && kOut >= 0) {
    const t = (kOut + 1) / E_OUT;
    x = -W * REACH * Easing.in(Easing.cubic)(t);
  } else if (!isFirst) {
    if (frame < E_IN) {
      x = W * REACH * Math.pow(1 - frame / E_IN, 3);
    }
    const elapsed = frame - E_IN; // landing frame = 0
    if (elapsed >= 0 && elapsed <= SHAKE_FRAMES) {
      const decay = interpolate(elapsed, [0, SHAKE_FRAMES], [1, 0], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      shakeX = (pseudoRand(frame, 1) - 0.5) * 2 * AMP * decay;
      shakeY = (pseudoRand(frame, 2) - 0.5) * 2 * AMP * decay;
      shakeRot = (pseudoRand(frame, 3) - 0.5) * 2 * ROT * decay;
      scale = 1 + 0.06 * decay; // hides shake edges
      flash = interpolate(elapsed, [0, 2, 6], [0.35, 0.3, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }
  return (
    <AbsoluteFill style={{ backgroundColor: DARK, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          transform: `translate(${(x + shakeX).toFixed(2)}px, ${shakeY.toFixed(2)}px) rotate(${shakeRot.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
        }}
      >
        {children}
      </AbsoluteFill>
      {flash > 0.001 ? (
        <AbsoluteFill style={{ backgroundColor: '#ffffff', opacity: flash, pointerEvents: 'none' }} />
      ) : null}
    </AbsoluteFill>
  );
};
