import { describe, it, expect } from 'vitest';
import { visualSegments } from './visuals';
import { INNER_CUTS } from './shots';
import type { Visual } from '../types/beat';

const v = (at_sec: number, url = `https://a/${at_sec}.jpg`): Visual => ({ url, at_sec, layout: 'single' });

describe('visualSegments', () => {
  it('segments tile the beat exactly', () => {
    const segs = visualSegments([v(0), v(4.2), v(7.9)], 300, 30, 0);
    expect(segs.map((s) => s.from)).toEqual([0, 126, 237]);
    expect(segs.reduce((n, s) => n + s.durationInFrames, 0)).toBe(300);
    expect(segs.map((s) => s.visual.at_sec)).toEqual([0, 4.2, 7.9]);
  });

  it('inner cuts at every visual boundary, random from INNER_CUTS, no two in a row equal', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed <= 30; seed++) {
      const segs = visualSegments([v(0), v(2), v(4), v(6), v(8)], 300, 30, seed);
      for (let k = 1; k < segs.length; k++) {
        expect(INNER_CUTS).toContain(segs[k].entryCut);
        expect(segs[k].entryCut).toBe(segs[k - 1].exitCut);
        if (k > 1) expect(segs[k].entryCut).not.toBe(segs[k - 1].entryCut);
        seen.add(segs[k].entryCut!);
      }
    }
    INNER_CUTS.forEach((c) => expect(seen).toContain(c));
  });

  it('first segment has no entryCut, last has no exitCut', () => {
    const segs = visualSegments([v(0), v(5)], 300, 30, 3);
    expect(segs[0].entryCut).toBeUndefined();
    expect(segs[segs.length - 1].exitCut).toBeUndefined();
  });

  it('deterministic per seed', () => {
    expect(visualSegments([v(0), v(3), v(6)], 300, 30, 7)).toEqual(visualSegments([v(0), v(3), v(6)], 300, 30, 7));
  });

  it('a visual starting past the beat end is dropped, never a zero-length segment', () => {
    const segs = visualSegments([v(0), v(9.99)], 300, 30, 0);
    segs.forEach((s) => expect(s.durationInFrames).toBeGreaterThan(0));
    expect(segs.reduce((n, s) => n + s.durationInFrames, 0)).toBe(300);
  });
});
