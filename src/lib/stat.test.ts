import { describe, it, expect } from 'vitest';
import {
  COUNT_UP_SECONDS,
  columnVisibility,
  countUpValue,
  formatStat,
  odometerText,
  odometerUnits,
} from './stat';

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

describe('odometer display (sweep every frame)', () => {
  const fps = 30;
  const total = Math.round(COUNT_UP_SECONDS * fps);
  const cases: Array<[number, number]> = [
    [27.4, 1],
    [1250, 0],
    [1234.5, 1],
    [5, 0],
    [0.4, 1],
    [100, 0],
    [9.99, 2],
    [1000000, 0],
    [88888888, 0],
    [-12.5, 1],
  ];

  it('value is monotone, and lands EXACTLY on the target text at the last count frame', () => {
    for (const [target, decimals] of cases) {
      let prev = -1;
      for (let f = 0; f <= total + 40; f++) {
        const units = odometerUnits(target, decimals, countUpValue(f, fps, 1));
        expect(units).toBeGreaterThanOrEqual(prev);
        prev = units;
      }
      expect(countUpValue(total, fps, 1)).toBe(1);
      const final = odometerText(target, decimals, odometerUnits(target, decimals, countUpValue(total, fps, 1)));
      expect(final).toBe(formatStat(target, decimals));
    }
  });

  it('never shows a leading-zero artefact (03.3, 0,034) unless the value is < 1', () => {
    for (const [target, decimals] of cases) {
      for (let f = 0; f <= total + 5; f++) {
        const units = odometerUnits(target, decimals, countUpValue(f, fps, 1));
        const text = odometerText(target, decimals, units).replace(/^-/, '');
        expect(text).not.toMatch(/^0\d/);
        expect(text).not.toMatch(/^,/);
        expect(text.length).toBeGreaterThan(0);
        if (units >= 10 ** decimals) expect(text).not.toMatch(/^0/);
      }
    }
  });

  it('27.4 early frames read 0.0 then small values, never 03.3', () => {
    const early: string[] = [];
    for (let f = 0; f <= 6; f++) early.push(odometerText(27.4, 1, odometerUnits(27.4, 1, countUpValue(f, fps, 1))));
    for (const t of early) expect(t).not.toMatch(/^0\d/);
    expect(early[0]).toBe('0.0');
  });

  it('hides higher columns only, never the ones column; comma follows its left digits', () => {
    const template = '1,234.5';
    expect(columnVisibility(template, 0, 1)).toEqual([false, false, false, false, true, true, true]);
    expect(columnVisibility(template, 12345, 1)).toEqual([true, true, true, true, true, true, true]);
    expect(columnVisibility(template, 55, 1)).toEqual([false, false, false, false, true, true, true]);
  });
});
