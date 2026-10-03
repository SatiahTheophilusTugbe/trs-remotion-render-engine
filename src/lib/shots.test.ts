import { describe, it, expect } from 'vitest';
import {
  FRAMING_CYCLE,
  MID_SCALE,
  TIGHT_SCALE,
  WIDE_SCALE,
  focalObjectPosition,
  planShots,
  shotCount,
  type PlanOptions,
} from './shots';

const FPS = 30;
const focal = { x: 0.5, y: 0.4 };
const opts = (o: Partial<PlanOptions> = {}): PlanOptions => ({ focal, seed: 0, slamIn: true, whiskOut: true, ...o });

describe('shotCount', () => {
  it('is always 1 without a focal point', () => {
    expect(shotCount(420, FPS, false)).toBe(1);
  });
  it.each([
    [10.9, 2],
    [9.4, 2],
    [14, 2],
    [6, 2],
    [5, 1],
    [2.5, 1],
    [1, 1],
  ])('%ss with focal -> %i shots', (sec, n) => {
    expect(shotCount(Math.round(sec * FPS), FPS, true)).toBe(n);
  });
});

describe('planShots', () => {
  it('no focal: one full-frame wide shot spanning the beat', () => {
    expect(planShots(330, FPS, opts({ focal: null }))).toEqual([
      { from: 0, durationInFrames: 330, scale: WIDE_SCALE, entry: 'slam', whiskOut: true },
    ]);
  });

  it('shots tile the beat exactly', () => {
    for (const d of [30, 282, 327, 333, 420]) {
      const shots = planShots(d, FPS, opts());
      expect(shots[0].from).toBe(0);
      for (let i = 1; i < shots.length; i++) {
        expect(shots[i].from).toBe(shots[i - 1].from + shots[i - 1].durationInFrames);
      }
      expect(shots.reduce((s, x) => s + x.durationInFrames, 0)).toBe(d);
    }
  });

  it('frames wide then tight (one cut per beat)', () => {
    expect(FRAMING_CYCLE).toEqual([WIDE_SCALE, TIGHT_SCALE, MID_SCALE]);
    expect(MID_SCALE).toBe(1.1);
    expect(planShots(420, FPS, opts()).map((s) => s.scale)).toEqual([WIDE_SCALE, TIGHT_SCALE]);
  });

  it('first entry is slam only when slamIn', () => {
    expect(planShots(420, FPS, opts()).map((s) => s.entry)[0]).toBe('slam');
    expect(planShots(420, FPS, opts({ slamIn: false }))[0].entry).toBe('none');
  });

  it('the inner cut is hardPunch or whip, varying by seed', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed <= 10; seed++) {
      const inner = planShots(420, FPS, opts({ seed })).slice(1).map((s) => s.entry);
      expect(inner).toHaveLength(1);
      expect(['hardPunch', 'whip']).toContain(inner[0]);
      seen.add(inner[0]);
    }
    expect(seen.size).toBe(2);
  });

  it('is deterministic for the same seed', () => {
    expect(planShots(420, FPS, opts({ seed: 7 }))).toEqual(planShots(420, FPS, opts({ seed: 7 })));
  });

  it('whiskOut only on the last shot and only when requested', () => {
    expect(planShots(420, FPS, opts()).map((s) => s.whiskOut)).toEqual([false, true]);
    expect(planShots(420, FPS, opts({ whiskOut: false })).some((s) => s.whiskOut)).toBe(false);
  });

  it('returns no shots for an empty beat', () => {
    expect(planShots(0, FPS, opts())).toEqual([]);
  });
});

describe('focalObjectPosition', () => {
  it('maps focal to object-position percentages', () => {
    expect(focalObjectPosition({ x: 0.25, y: 0.4 })).toBe('25.00% 40.00%');
  });
  it('falls back to the existing centre-top framing', () => {
    expect(focalObjectPosition(null)).toBe('center top');
    expect(focalObjectPosition(undefined)).toBe('center top');
  });
});
