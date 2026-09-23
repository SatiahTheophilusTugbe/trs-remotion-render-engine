import { describe, it, expect } from 'vitest';
import { framesForBeats, framesForBeat } from './duration';

describe('framesForBeats', () => {
  it('sums beat durations and converts to frames at the given fps', () => {
    const beats = [
      { duration_sec: 2 },
      { duration_sec: 3.5 },
      { duration_sec: 1 },
    ];
    expect(framesForBeats(beats, 30)).toBe(Math.round(6.5 * 30));
  });

  it('supports a beat count the old fixed 5-beat HyperFrames template could not', () => {
    const beats = Array.from({ length: 11 }, () => ({ duration_sec: 2 }));
    expect(framesForBeats(beats, 30)).toBe(Math.round(22 * 30));
  });

  it('returns 0 for an empty beat array', () => {
    expect(framesForBeats([], 30)).toBe(0);
  });

  it('matches the sum of per-beat rounding for fractional durations (no cross-rounding drift)', () => {
    const beats = [
      { duration_sec: 1.01 },
      { duration_sec: 1.01 },
      { duration_sec: 2.34 },
      { duration_sec: 0.86 },
    ];
    const fps = 30;
    const expectedTotal = beats.reduce((sum, beat) => sum + framesForBeat(beat, fps), 0);
    expect(framesForBeats(beats, fps)).toBe(expectedTotal);
  });
});
