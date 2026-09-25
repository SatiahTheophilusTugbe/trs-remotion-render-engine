// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
// Technique ported from RenderComp free-remotion-templates WhipPan (MIT, Trimora Inc.):
// cubic-eased fast horizontal pan whose blur peaks with pan velocity.
// Re-skinned for TRS (1080x1920, dark backdrop) and re-timed to be NON-OVERLAPPING:
// the outgoing beat whips out during its last E frames, the incoming beat whips in during
// its first E frames, from the opposite side. Beat frame counts are untouched.
import { AbsoluteFill, Easing } from 'remotion';
import { useBeatFrames } from './fx';
import type { FxProps } from './fx';

const E = 7; // frames per side
const REACH = 0.55; // fraction of frame width travelled by the final/first frame
const MAX_BLUR = 46; // horizontal blur std-dev (px) at full speed
const W = 1080;
const FILTER_ID = 'bakeoff-whip-hblur';

const easeIn = Easing.in(Easing.cubic);

export const WhipPanFx: React.FC<FxProps> = ({ children, isFirst, isLast }) => {
  const { frame, durationInFrames } = useBeatFrames();
  let x = 0;
  let blur = 0;
  const kOut = frame - (durationInFrames - E);
  if (!isLast && kOut >= 0) {
    const p = easeIn((kOut + 1) / E); // 1 on the very last frame
    x = -W * REACH * p;
    blur = MAX_BLUR * p;
  } else if (!isFirst && frame < E) {
    const remaining = Math.pow(1 - frame / E, 3); // 1 on first frame, ~0 on frame E-1
    x = W * REACH * remaining;
    blur = MAX_BLUR * remaining;
  }
  const blurred = blur > 0.4;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {blurred ? (
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <filter id={FILTER_ID} x="-40%" y="0%" width="180%" height="100%">
            <feGaussianBlur stdDeviation={`${blur.toFixed(2)} 0`} />
          </filter>
        </svg>
      ) : null}
      <AbsoluteFill
        style={{
          transform: `translateX(${x.toFixed(2)}px)`,
          filter: blurred ? `url(#${FILTER_ID})` : undefined,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
