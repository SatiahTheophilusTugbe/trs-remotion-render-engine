import { describe, it, expect } from 'vitest';
import { cutStyleFor, impactCutFrames, wipeCutFrames } from './cuts';
import type { CutStyle } from './cuts';
import { layoutBeats } from './layout';
import { cutFrames } from './transitions';

type B = { type: 'avatar' | 'broll' | 'stat'; duration_sec: number };
const mk = (types: B['type'][]): B[] => types.map((type, i) => ({ type, duration_sec: 3 + (i % 3) * 0.5 }));

describe('cutStyleFor', () => {
  it('is none for the first beat', () => {
    expect(cutStyleFor(mk(['broll', 'avatar']), 0)).toBe('none');
    expect(cutStyleFor(mk(['stat', 'avatar']), 0)).toBe('none');
  });
  it('is slideShake into a stat beat or into the last beat, else wipe', () => {
    const beats = mk(['broll', 'avatar', 'broll', 'stat', 'broll', 'avatar']);
    expect(beats.map((_, i) => cutStyleFor(beats, i))).toEqual([
      'none', 'wipe', 'wipe', 'slideShake', 'wipe', 'slideShake',
    ]);
  });
  it('a single-beat story has no cuts', () => {
    expect(cutStyleFor(mk(['stat']), 0)).toBe('none');
    const slots = layoutBeats(mk(['stat']), 30);
    expect(impactCutFrames(mk(['stat']), slots)).toEqual([]);
    expect(wipeCutFrames(mk(['stat']), slots)).toEqual([]);
  });
  it('a two-beat story has one slideShake cut (incoming is last)', () => {
    const beats = mk(['broll', 'avatar']);
    expect([0, 1].map((i) => cutStyleFor(beats, i))).toEqual(['none', 'slideShake']);
  });
});

describe('cut frame partition (swept over stories of 2..12 beats)', () => {
  const kinds: B['type'][] = ['broll', 'avatar', 'stat'];
  it('every boundary has exactly one style and impact+wipe frames partition cutFrames', () => {
    for (let n = 2; n <= 12; n++) {
      for (let seed = 0; seed < 6; seed++) {
        const beats = mk(Array.from({ length: n }, (_, i) => kinds[(i * (seed + 1) + seed) % 3]));
        const slots = layoutBeats(beats, 30);
        const styles: CutStyle[] = beats.map((_, i) => cutStyleFor(beats, i));
        expect(styles[0]).toBe('none');
        for (let i = 1; i < n; i++) expect(['wipe', 'slideShake']).toContain(styles[i]);
        const impact = impactCutFrames(beats, slots);
        const wipe = wipeCutFrames(beats, slots);
        const expectImpact = slots.filter((_, i) => styles[i] === 'slideShake').map((s) => s.from);
        const expectWipe = slots.filter((_, i) => styles[i] === 'wipe').map((s) => s.from);
        expect(impact).toEqual(expectImpact);
        expect(wipe).toEqual(expectWipe);
        // 1:1 alignment with all cut frames, no overlap, nothing dropped
        const all = [...impact, ...wipe].sort((a, b) => a - b);
        expect(all).toEqual(cutFrames(slots));
        expect(new Set(all).size).toBe(all.length);
        expect(impact).toContain(slots[n - 1].from); // last beat is always an impact cut
      }
    }
  });
});
