import { describe, it, expect } from 'vitest';
import { layoutBeats, totalFrames } from './layout';
import { framesForBeats } from './duration';

describe('layoutBeats', () => {
  it('places beats back to back starting at frame 0', () => {
    expect(layoutBeats([{ duration_sec: 5 }, { duration_sec: 4 }], 30)).toEqual([
      { from: 0, durationInFrames: 150 },
      { from: 150, durationInFrames: 120 },
    ]);
  });

  it('returns no slots and 0 total frames for no beats', () => {
    expect(layoutBeats([], 30)).toEqual([]);
    expect(totalFrames([])).toBe(0);
  });

  it('never overlaps or leaves gaps, and totals exactly framesForBeats (fractional durations, 25 and 30 fps)', () => {
    const beats = [1.01, 1.01, 2.34, 0.86, 3.333, 0.5].map((duration_sec) => ({ duration_sec }));
    for (const fps of [25, 30]) {
      const slots = layoutBeats(beats, fps);
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i].from).toBe(slots[i - 1].from + slots[i - 1].durationInFrames);
      }
      expect(totalFrames(slots)).toBe(framesForBeats(beats, fps));
    }
  });
});
