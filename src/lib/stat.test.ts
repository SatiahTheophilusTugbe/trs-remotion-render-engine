import { describe, it, expect } from 'vitest';
import {
  COUNT_UP_SECONDS,
  columnVisibility,
  countUpValue,
  formatStat,
  odometerText,
  odometerUnits,
  wheelPos,
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

describe('odometer wheels settle on exact integers (trailing-9 regression)', () => {
  const fps = 30;
  const total = Math.round(COUNT_UP_SECONDS * fps);
  const targets: Array<[number, number]> = [
    [19, 0],
    [29, 0],
    [199, 0],
    [1999, 0],
    [1299, 0],
    [9.9, 1],
    [29.9, 1],
    [99.9, 1],
    [99999.9, 1],
    [999999, 0],
    [0, 0],
    [1250, 0],
    [27.4, 1],
    [1234.5, 1],
  ];
  const digitsOf = (target: number, decimals: number): string =>
    formatStat(target, decimals).replace(/[^0-9]/g, '');

  it('at the final frame and after, EVERY wheel is an integer equal to its template digit', () => {
    for (const [target, decimals] of targets) {
      const digits = digitsOf(target, decimals);
      for (let f = total; f <= total + 30; f++) {
        const units = odometerUnits(target, decimals, countUpValue(f, fps, 1));
        for (let idx = 0; idx < digits.length; idx++) {
          const place = digits.length - 1 - idx;
          const pos = wheelPos(units, place);
          expect(Number.isInteger(pos), `${target} place ${place} pos ${pos}`).toBe(true);
          expect(pos, `${target} place ${place}`).toBe(Number(digits[idx]));
        }
        expect(odometerText(target, decimals, units)).toBe(formatStat(target, decimals));
      }
    }
  });

  it('on EVERY frame the settled digits equal floor(units) and never exceed the target', () => {
    for (const [target, decimals] of targets) {
      const finalUnits = Math.round(target * 10 ** decimals);
      let prev = -1;
      for (let f = 0; f <= total + 10; f++) {
        const units = odometerUnits(target, decimals, countUpValue(f, fps, 1));
        const shown = Number(odometerText(target, decimals, units).replace(/[^0-9]/g, ''));
        expect(shown, `${target} frame ${f}`).toBe(Math.floor(units));
        expect(shown).toBeGreaterThanOrEqual(prev);
        expect(shown).toBeLessThanOrEqual(finalUnits);
        prev = shown;
      }
    }
  });

  it('a higher wheel only moves while the wheel below is between 9 and 10', () => {
    // 19.5 units: ones wheel is mid-roll 9 -> 0, so the tens wheel is half way 1 -> 2.
    expect(wheelPos(19.5, 0)).toBeCloseTo(9.5, 10);
    expect(wheelPos(19.5, 1)).toBeCloseTo(1.5, 10);
    // 12.7 units: ones wheel is at 2.7, tens wheel must sit exactly on 1.
    expect(wheelPos(12.7, 1)).toBe(1);
    // 199 settled: 1, 9, 9 exactly.
    expect([2, 1, 0].map((p) => wheelPos(199, p))).toEqual([1, 9, 9]);
    // 199.9: ones 9.9, tens 9.9 (carry from 9.9), hundreds 1.9.
    expect(wheelPos(199.9, 2)).toBeCloseTo(1.9, 10);
  });
});
