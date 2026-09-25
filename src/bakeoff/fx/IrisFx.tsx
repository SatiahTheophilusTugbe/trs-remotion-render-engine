// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
// Technique ported from RenderComp free-remotion-templates TransitionCircleWipe (MIT, Trimora Inc.):
// centred clip-path circle sized to clear the frame corners, inOut-cubic radius, accent edge
// ring that is thick when small and thins as it clears the frame.
// Re-skinned (lime ring on dark) and NON-OVERLAPPING: the outgoing beat irises closed over its
// last E frames, the incoming beat irises open over its first E frames. Beat lengths untouched.
import { AbsoluteFill, Easing } from 'remotion';
import { useBeatFrames } from './fx';
import type { FxProps } from './fx';
import { DARK, LIME } from '../shared';

const E = 8;
const W = 1080;
const H = 1920;
const MAX_R = (Math.sqrt(W * W + H * H) / 2) * 1.04;
const MIN_R = 70; // never fully black: a small lime-ringed disc remains at the cut
const inOut = Easing.inOut(Easing.cubic);

export const IrisFx: React.FC<FxProps> = ({ children, isFirst, isLast }) => {
  const { frame, durationInFrames } = useBeatFrames();
  let openness = 1; // 1 = fully open
  const kOut = frame - (durationInFrames - E);
  if (!isLast && kOut >= 0) {
    openness = 1 - inOut((kOut + 1) / (E + 1));
  } else if (!isFirst && frame < E) {
    openness = inOut((frame + 1) / (E + 1));
  }
  const active = openness < 1;
  const r = MIN_R + (MAX_R - MIN_R) * openness;
  const ringW = 14 + (1 - openness) * 40;
  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      <AbsoluteFill
        style={{
          clipPath: active ? `circle(${r.toFixed(1)}px at 50% 50%)` : undefined,
        }}
      >
        {children}
      </AbsoluteFill>
      {active ? (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', top: 0, left: 0 }}>
          <circle
            cx={W / 2}
            cy={H / 2}
            r={Math.max(0, r - ringW / 2)}
            fill="none"
            stroke={LIME}
            strokeWidth={ringW}
            opacity={openness > 0.97 ? (1 - openness) / 0.03 : 1}
          />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
