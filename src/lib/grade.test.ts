import { describe, expect, it } from 'vitest';
import { GRADE_G3, TABLE_SIZE, tableValuesString, toneCurve, toneTable } from './grade';

const CHANNELS = ['r', 'g', 'b'] as const;

describe('GRADE_G3', () => {
  it('matches the exact numeric params ported from src/bakeoff/grade/grades.ts G3', () => {
    expect(GRADE_G3.id).toBe('G3');
    expect(GRADE_G3.saturation).toBe(0.6);
    expect(GRADE_G3.contrast).toBe(0.36);
    expect(GRADE_G3.exposure).toBe(1.0);
    expect(GRADE_G3.blackPoint).toBe(0.02);
    expect(GRADE_G3.whitePoint).toBe(0.98);
    expect(GRADE_G3.channelGain).toEqual({ r: 1.02, g: 1, b: 0.98 });
    expect(GRADE_G3.shadowTint).toEqual({ r: -0.03, g: 0.038, b: -0.02 });
    expect(GRADE_G3.midTint).toEqual({ r: 0.022, g: -0.008, b: -0.006 });
    expect(GRADE_G3.highlightTint).toEqual({ r: 0.0, g: 0.004, b: 0.0 });
    expect(GRADE_G3.vignette).toEqual({ strength: 0.5, inner: 0.48, color: '#010803' });
  });
});

describe('toneCurve', () => {
  it('produces the deep green-black shadow character: green pushed above red/blue near black', () => {
    // Near x=0 the shadowTint term ((1-v)^2 weight) dominates: g > r and g > b.
    const r = toneCurve('r', 0);
    const g = toneCurve('g', 0);
    const b = toneCurve('b', 0);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('is bounded to [0, 1] and deterministic across repeated calls', () => {
    for (const ch of CHANNELS) {
      for (let i = 0; i <= 20; i++) {
        const x = i / 20;
        const v1 = toneCurve(ch, x);
        const v2 = toneCurve(ch, x);
        expect(v1).toBe(v2); // pure function, no Math.random/Date.now
        expect(v1).toBeGreaterThanOrEqual(0);
        expect(v1).toBeLessThanOrEqual(1);
      }
    }
  });

  it('crushes blacks at/below blackPoint to 0 and rolls whites at/above whitePoint toward 1', () => {
    expect(toneCurve('r', 0)).toBeGreaterThanOrEqual(0);
    expect(toneCurve('b', GRADE_G3.blackPoint)).toBeCloseTo(0, 1);
    expect(toneCurve('g', GRADE_G3.whitePoint)).toBeGreaterThan(0.95);
  });
});

describe('toneTable', () => {
  it('is TABLE_SIZE long, monotonic non-decreasing, and bounded, for every channel', () => {
    for (const ch of CHANNELS) {
      const t = toneTable(ch);
      expect(t).toHaveLength(TABLE_SIZE);
      for (let i = 0; i < t.length; i++) {
        expect(t[i]).toBeGreaterThanOrEqual(0);
        expect(t[i]).toBeLessThanOrEqual(1);
        if (i > 0) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1] - 1e-9);
      }
    }
  });

  it('supports a custom table size', () => {
    expect(toneTable('r', 5)).toHaveLength(5);
  });
});

describe('tableValuesString', () => {
  it('formats a tone table deterministically for the SVG feFuncX tableValues attribute', () => {
    expect(tableValuesString([0, 0.5, 1])).toBe('0.0000 0.5000 1.0000');
  });
});
