import { describe, expect, it } from 'vitest';
import {
  G0,
  GRADES,
  PARAM_BOUNDS,
  flattenParams,
  gradeById,
  gradeOutOfBounds,
  tableValuesString,
  toneCurve,
  toneTable,
  TABLE_SIZE,
} from './grades';

describe('grade definitions', () => {
  it('has G0..G4 in order with unique ids and names', () => {
    expect(GRADES.map((g) => g.id)).toEqual(['G0', 'G1', 'G2', 'G3', 'G4']);
    expect(new Set(GRADES.map((g) => g.name)).size).toBe(GRADES.length);
    expect(gradeById('G3').name).toContain('Green-Black');
    expect(() => gradeById('G9')).toThrow();
  });

  it('keeps every param inside its bounds', () => {
    for (const g of GRADES) expect(gradeOutOfBounds(g), g.id).toEqual([]);
  });

  it('flattenParams covers exactly the bounded keys', () => {
    expect(Object.keys(flattenParams(G0)).sort()).toEqual(Object.keys(PARAM_BOUNDS).sort());
  });

  it('detects an out-of-bounds param', () => {
    expect(gradeOutOfBounds({ ...G0, saturation: 3 })).toContain('saturation');
    expect(gradeOutOfBounds({ ...G0, blackPoint: 0.5, whitePoint: 0.95 })).toContain('blackPoint');
    expect(gradeOutOfBounds({ ...G0, blackLift: 0.14, whiteCap: 0.86, blackPoint: 0.2 })).toContain('blackPoint');
  });

  it('makes every grade differ from every other (no accidental duplicates)', () => {
    for (let i = 0; i < GRADES.length; i++) {
      for (let j = i + 1; j < GRADES.length; j++) {
        const a = flattenParams(GRADES[i]);
        const b = flattenParams(GRADES[j]);
        let differing = 0;
        for (const k of Object.keys(a)) if (Math.abs(a[k] - b[k]) > 1e-9) differing++;
        expect(differing, `${GRADES[i].id} vs ${GRADES[j].id}`).toBeGreaterThanOrEqual(4);
        // the tone tables must differ visibly in at least one channel
        let maxDiff = 0;
        for (const ch of ['r', 'g', 'b'] as const) {
          const ta = toneTable(GRADES[i], ch);
          const tb = toneTable(GRADES[j], ch);
          for (let n = 0; n < ta.length; n++) maxDiff = Math.max(maxDiff, Math.abs(ta[n] - tb[n]));
        }
        expect(maxDiff, `${GRADES[i].id} vs ${GRADES[j].id} tone`).toBeGreaterThan(0.005);
      }
    }
  });

  it('G0 is the identity curve', () => {
    for (const ch of ['r', 'g', 'b'] as const) {
      for (let i = 0; i <= 10; i++) expect(toneCurve(G0, ch, i / 10)).toBeCloseTo(i / 10, 9);
    }
  });

  it('tone tables are bounded, monotonic non-decreasing and the right size', () => {
    for (const g of GRADES) {
      for (const ch of ['r', 'g', 'b'] as const) {
        const t = toneTable(g, ch);
        expect(t).toHaveLength(TABLE_SIZE);
        for (let i = 0; i < t.length; i++) {
          expect(t[i]).toBeGreaterThanOrEqual(0);
          expect(t[i]).toBeLessThanOrEqual(1);
          if (i > 0) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1] - 1e-9);
        }
      }
    }
  });

  it('encodes the intended character of each look', () => {
    const [, g1, g2, g3, g4] = GRADES;
    expect(g1.saturation).toBeCloseTo(0.88, 2);
    expect(g1.shadowTint.b).toBeGreaterThan(g1.shadowTint.r); // cool shadows
    expect(g2.shadowTint.b).toBeGreaterThan(0); // cyan-ish shadows
    expect(g2.highlightTint.r).toBeGreaterThan(g2.highlightTint.b); // warm highlights
    expect(g2.bloom.intensity).toBeGreaterThan(0);
    expect(g3.saturation).toBeLessThanOrEqual(0.62);
    expect(g3.shadowTint.g).toBeGreaterThan(g3.shadowTint.r); // green-black shadows
    expect(g4.blackLift).toBeGreaterThan(0.05); // matte blacks
    expect(g4.grain).toBeGreaterThan(0);
    expect(g4.contrast).toBeLessThan(g1.contrast); // softer than noir
  });

  it('matte blacks lift and noir blacks deepen', () => {
    expect(toneCurve(gradeById('G4'), 'g', 0)).toBeGreaterThan(0.05);
    expect(toneCurve(gradeById('G1'), 'r', 0.02)).toBe(0);
  });

  it('formats table values deterministically', () => {
    expect(tableValuesString([0, 0.5, 1])).toBe('0.0000 0.5000 1.0000');
  });
});
