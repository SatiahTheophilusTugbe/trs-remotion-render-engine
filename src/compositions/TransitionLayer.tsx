import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { WIPE_WIDTH, wipeOffsetPx } from '../lib/transitions';

export const TransitionLayer: React.FC<{ cuts: number[] }> = ({ cuts }) => {
  const frame = useCurrentFrame();
  for (const cut of cuts) {
    const x = wipeOffsetPx(frame, cut);
    if (x !== null) {
      return (
        <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: WIPE_WIDTH,
              height: 1920,
              backgroundColor: '#CCFF00',
              transform: `translateX(${x}px) skewX(-12deg)`,
            }}
          />
        </AbsoluteFill>
      );
    }
  }
  return null;
};
