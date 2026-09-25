// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
// Techniques ported from RenderComp free-remotion-templates SlideWipe (eased horizontal page
// slide over a dark backdrop, never raw black) and CameraShake (deterministic sin-hash
// pseudo-random shake vector x decay curve, plus an impact flash). MIT, Trimora Inc.
// Wraps one beat's content inside its <Sequence>. NON-OVERLAPPING: beat lengths are untouched.
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { slideShakeState } from '../lib/slideShake';

export const SlideShakeCut: React.FC<{
  slideOut: boolean;
  slideIn: boolean;
  children: React.ReactNode;
}> = ({ slideOut, slideIn, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = slideShakeState(frame, durationInFrames, { slideOut, slideIn });
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          transform: `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px) rotate(${s.rot.toFixed(3)}deg) scale(${s.scale.toFixed(4)})`,
        }}
      >
        {children}
      </AbsoluteFill>
      {s.flash > 0.001 ? (
        <AbsoluteFill style={{ backgroundColor: '#ffffff', opacity: s.flash, pointerEvents: 'none' }} />
      ) : null}
    </AbsoluteFill>
  );
};
