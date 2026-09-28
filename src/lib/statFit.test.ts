import { describe, it, expect } from 'vitest';
import {
  DIGIT_EM,
  SEP_EM,
  AFFIX_RATIO,
  STAT_INNER_W,
  STAT_MAX_FONT,
  STAT_MIN_FONT,
  fitFontSize,
  fitLabel,
  fitStatFontSize,
  leadingHiddenEm,
  statWidthEm,
  textWidthEm,
} from './statFit';
import { COUNT_UP_SECONDS, columnVisibility, countUpValue, formatStat, odometerUnits } from './stat';

describe('fitFontSize', () => {
  const widest = ['W', 'M', '8', '$', 'm', '%'];

  it('never exceeds the width, the maximum, or drops below the minimum, for lengths 1..12', () => {
    for (const ch of widest) {
      for (let len = 1; len <= 12; len++) {
        const text = ch.repeat(len);
        const size = fitFontSize(text, STAT_INNER_W, STAT_MAX_FONT, STAT_MIN_FONT);
        expect(size).toBeLessThanOrEqual(STAT_MAX_FONT);
        expect(size).toBeGreaterThanOrEqual(STAT_MIN_FONT);
        expect(textWidthEm(text) * size).toBeLessThanOrEqual(STAT_INNER_W);
      }
    }
  });

  it('is monotone non-increasing as the text grows (each extra char)', () => {
    const base = '$1,234.5MWPPG88';
    let prev = Infinity;
    for (let len = 1; len <= 12; len++) {
      const size = fitFontSize(base.slice(0, len), STAT_INNER_W, STAT_MAX_FONT, STAT_MIN_FONT);
      expect(size).toBeLessThanOrEqual(prev);
      prev = size;
    }
  });

  it('respects the clamp: tiny text gets the max, impossible text gets the min', () => {
    expect(fitFontSize('1', STAT_INNER_W, 230, 60)).toBe(230);
    expect(fitFontSize('W'.repeat(40), 300, 230, 60)).toBe(60);
  });

  it('27.4 PPG and $1,234.5M both fit at the chosen size', () => {
    const cases: Array<[number, number, string, string]> = [
      [27.4, 1, '', ' PPG'],
      [1234.5, 1, '$', 'M'],
    ];
    for (const [v, d, p, s] of cases) {
      const number = formatStat(v, d);
      const full = formatStat(v, d, p, s);
      const size = fitFontSize(full, STAT_INNER_W, STAT_MAX_FONT, STAT_MIN_FONT);
      expect(textWidthEm(full) * size).toBeLessThanOrEqual(STAT_INNER_W);
      const fs = fitStatFontSize(number, p, s, STAT_INNER_W, STAT_MAX_FONT, STAT_MIN_FONT);
      expect(statWidthEm(number, p, s) * fs).toBeLessThanOrEqual(STAT_INNER_W);
      // the affix-aware fit may only be larger (affixes render smaller) or equal
      expect(fs).toBeGreaterThanOrEqual(size);
    }
  });

  it('digits and separators use the same cell widths as the odometer layout', () => {
    expect(textWidthEm('8')).toBe(DIGIT_EM);
    expect(textWidthEm('.')).toBe(SEP_EM);
    expect(textWidthEm(',')).toBe(SEP_EM);
  });
});

describe('fitStatFontSize sweep', () => {
  it('full layout width fits the inner card for 10-char stats (worst-case affixes)', () => {
    const cases: Array<[number, number, string, string]> = [
      [27.4, 1, '', ' PPG'],
      [1250, 0, '', ''],
      [1234.5, 1, '$', 'M'],
      [88888888, 0, '', ''],
      [8888888.88, 2, '', ''],
      [8888, 0, '$', ' MPH'],
      [88, 0, 'WWWW', 'WWWW'],
      [0.4, 1, '', '%'],
      [-12.5, 1, '', ' PTS'],
      [999999, 0, '+', 'K'],
    ];
    for (const [value, decimals, prefix, suffix] of cases) {
      const number = formatStat(value, decimals);
      const fs = fitStatFontSize(number, prefix, suffix, STAT_INNER_W, STAT_MAX_FONT, STAT_MIN_FONT);
      expect(fs).toBeGreaterThanOrEqual(STAT_MIN_FONT);
      expect(fs).toBeLessThanOrEqual(STAT_MAX_FONT);
      expect(statWidthEm(number, prefix, suffix) * fs).toBeLessThanOrEqual(STAT_INNER_W);
    }
  });

  it('affixes are scaled by AFFIX_RATIO', () => {
    expect(statWidthEm('8', 'W', '')).toBeGreaterThan(statWidthEm('8', '', ''));
    expect(statWidthEm('8', 'W', '') - statWidthEm('8', '', '')).toBeLessThan(textWidthEm('W'));
    expect(AFFIX_RATIO).toBeLessThan(1);
  });
});

describe('fitLabel', () => {
  it('fits in at most two lines for every label length 0..40 (uppercase worst case)', () => {
    for (let len = 0; len <= 40; len++) {
      const label = 'W'.repeat(len);
      const { fontSize, lines } = fitLabel(label, STAT_INNER_W);
      expect(fontSize).toBeGreaterThan(0);
      expect(lines === 1 || lines === 2).toBe(true);
      // total estimated width (incl. tracking) fits in `lines` rows of the inner width
      expect((textWidthEm(label) + len * 0.08) * fontSize).toBeLessThanOrEqual(STAT_INNER_W * lines);
    }
  });

  it('short labels stay on one line at the max size; sizes never grow with length', () => {
    expect(fitLabel('Career points', STAT_INNER_W).lines).toBe(1);
    let prev = Infinity;
    for (let len = 1; len <= 40; len++) {
      const { fontSize } = fitLabel('W'.repeat(len), STAT_INNER_W);
      expect(fontSize).toBeLessThanOrEqual(prev);
      prev = fontSize;
    }
  });
});

describe('leadingHiddenEm (prefix hugs the first visible digit)', () => {
  it('sums the widths of the hidden leading columns only', () => {
    expect(leadingHiddenEm('1,234.5', [true, true, true, true, true, true, true])).toBe(0);
    expect(leadingHiddenEm('1,234.5', [false, false, false, false, true, true, true])).toBeCloseTo(
      3 * DIGIT_EM + SEP_EM,
      10,
    );
    // a later hidden column (never produced by columnVisibility) does not count
    expect(leadingHiddenEm('12', [true, false])).toBe(0);
  });

  it('sweep: offset is >= 0, never grows during the count-up, is 0 at the end, and stays inside the row', () => {
    const fps = 30;
    const total = Math.round(COUNT_UP_SECONDS * fps);
    const cases: Array<[number, number]> = [
      [27.4, 1],
      [1250, 0],
      [1234.5, 1],
      [99999.9, 1],
      [1999, 0],
      [8888888.88, 2],
    ];
    for (const [target, decimals] of cases) {
      const template = formatStat(target, decimals);
      const rowEm = textWidthEm(template);
      let prev = Infinity;
      for (let f = 0; f <= total + 10; f++) {
        const units = odometerUnits(target, decimals, countUpValue(f, fps, 1));
        const off = leadingHiddenEm(template, columnVisibility(template, units, decimals));
        expect(off).toBeGreaterThanOrEqual(0);
        expect(off).toBeLessThan(rowEm);
        expect(off).toBeLessThanOrEqual(prev + 1e-9);
        prev = off;
      }
      expect(prev).toBe(0);
    }
  });
});
