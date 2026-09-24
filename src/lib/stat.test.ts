import { describe, it, expect } from 'vitest';
import { COUNT_UP_SECONDS, countUpValue, formatStat } from './stat';

describe('countUpValue', () => {
  const fps = 30;
  const total = Math.round(COUNT_UP_SECONDS * fps);

  it('starts at 0 and lands exactly on the target', () => {
    expect(countUpValue(0, fps, 1250)).toBe(0);
    expect(countUpValue(total, fps, 1250)).toBe(1250);
    expect(countUpValue(total + 200, fps, 1250)).toBe(1250);
  });

  it('on EVERY frame stays within [0,target] and never decreases', () => {
    for (const target of [7, 1250, 0.4]) {
      let prev = -1;
      for (let f = 0; f <= total + 30; f++) {
        const v = countUpValue(f, fps, target);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(target);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });

  it('clamps negative frames to 0', () => {
    expect(countUpValue(-5, fps, 100)).toBe(0);
  });
});

describe('formatStat', () => {
  it('formats with thousands separators, decimals, prefix and suffix', () => {
    expect(formatStat(1234.5, 1, '$', 'M')).toBe('$1,234.5M');
    expect(formatStat(42)).toBe('42');
    expect(formatStat(99.6, 0)).toBe('100');
  });
});
