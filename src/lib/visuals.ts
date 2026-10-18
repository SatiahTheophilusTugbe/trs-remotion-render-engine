// Named-subject visuals (2026-10-17): a beat shows several images in turn, each from its at_sec. Pure:
// maps visuals to frame segments that tile the beat, with a random inner cut at every boundary.
import type { Visual } from '../types/beat';
import { INNER_CUTS, mulberry32, type InnerCut } from './shots';

export type VisualSegment = {
  from: number;
  durationInFrames: number;
  visual: Visual;
  entryCut?: InnerCut;
  exitCut?: InnerCut;
};

export const visualSegments = (visuals: Visual[], durationInFrames: number, fps: number, seed: number): VisualSegment[] => {
  const starts = visuals.map((v) => Math.round(v.at_sec * fps));
  // A visual that would start at or after the beat end (or not after the previous one) gets no frames: drop it.
  const kept = visuals.filter((_, i) => starts[i] < durationInFrames && (i === 0 || starts[i] > starts[i - 1]));
  const froms = kept.map((v, i) => (i === 0 ? 0 : Math.round(v.at_sec * fps)));
  const segs: VisualSegment[] = kept.map((visual, i) => ({
    from: froms[i],
    durationInFrames: (i + 1 < kept.length ? froms[i + 1] : durationInFrames) - froms[i],
    visual,
  }));
  let prev: InnerCut | undefined;
  for (let k = 1; k < segs.length; k++) {
    const pool = INNER_CUTS.filter((c) => c !== prev);
    const cut = pool[Math.floor(mulberry32(seed * 131 + k) * pool.length) % pool.length];
    segs[k].entryCut = cut;
    segs[k - 1].exitCut = cut;
    prev = cut;
  }
  return segs;
};
