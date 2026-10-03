import { describe, it, expect } from 'vitest';
import { creditProgress } from './creditMotion';

describe('creditProgress', () => {
  const fps = 30;
  const dur = 300; // 10s beat
  it('is hidden at the start, slides in, holds, slides out in reverse, hidden at the end', () => {
    expect(creditProgress(0, dur, fps)).toBe(0);
    expect(creditProgress(10, dur, fps)).toBe(0); // 0.33s: still waiting for the photo to settle
    expect(creditProgress(16, dur, fps)).toBeGreaterThan(0);
    expect(creditProgress(16, dur, fps)).toBeLessThan(1);
    expect(creditProgress(150, dur, fps)).toBe(1);
    expect(creditProgress(dur - 5, dur, fps)).toBe(0);
    expect(creditProgress(dur, dur, fps)).toBe(0);
  });
  it('slide-out mirrors slide-in', () => {
    // in starts at 11, out ends at 300-5=295; frame 11+k mirrors frame 295-k
    for (const k of [2, 5, 8]) {
      expect(creditProgress(11 + k, dur, fps)).toBeCloseTo(creditProgress(295 - k, dur, fps));
    }
  });
  it('stays hidden on a beat too short for a clean in and out', () => {
    for (let f = 0; f < 30; f++) expect(creditProgress(f, 30, fps)).toBe(0);
  });
  it('never leaves 0..1', () => {
    for (let f = -10; f < dur + 10; f++) {
      const p = creditProgress(f, dur, fps);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});
