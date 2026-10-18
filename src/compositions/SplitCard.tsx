import { AbsoluteFill } from 'remotion';
import type { Focal } from '../types/beat';
import type { ShotFrame } from '../lib/shotMotion';
import { BeatBackground } from './BeatBackground';

// Two subjects named less than 1.5s apart share the frame (named-subject visuals, 2026-10-17): left and
// right halves, each centred on its own subject, split by a lime divider. Hold motion only, no crops.
const HALF = 540;
const DIVIDER = 6;
const pos = (f?: Focal | null) => (f ? `${(f.x * 100).toFixed(2)}% ${(f.y * 100).toFixed(2)}%` : 'center top');

export const SplitCard: React.FC<{
  urlA: string;
  urlB: string;
  focalA?: Focal | null;
  focalB?: Focal | null;
  shot: ShotFrame;
}> = ({ urlA, urlB, focalA, focalB, shot }) => {
  const half = (url: string, focal: Focal | null | undefined, left: number) => (
    <div style={{ position: 'absolute', top: 0, left, width: HALF, height: '100%', overflow: 'hidden' }}>
      <BeatBackground photoUrl={url} objectPosition={pos(focal)} shot={shot} layout="cover" />
    </div>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {half(urlA, focalA, 0)}
      {half(urlB, focalB, HALF)}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: HALF - DIVIDER / 2, width: DIVIDER, background: '#CCFF00' }} />
    </AbsoluteFill>
  );
};
