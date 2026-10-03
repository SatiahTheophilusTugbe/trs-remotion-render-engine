import { describe, it, expect } from 'vitest';
import { HOLD_MOVES, MOVE_SCALE, MOVE_SHIFT, planShots, type PlanOptions } from './shots';
import { SHAKE_FRAMES, SLAM_FRAMES, WHISK_FRAMES, holdMove, shotFrameAt } from './shotMotion';
import type { Focal } from '../types/beat';

const FPS = 30;
const person: Focal = { x: 0.5, y: 0.4, w: 0.15, h: 0.25 };
const plan = (d: number, o: Partial<PlanOptions> = {}) =>
  planShots(d, FPS, { focal: person, aspect: 1.5, seed: 0, slamIn: true, whiskOut: true, ...o });

describe('shotFrameAt edge safety', () => {
  const focals: (Focal | null)[] = [
    null,
    { x: 0, y: 0 },
    { x: 1, y: 1, w: 0.1, h: 0.1 },
    person,
    { x: 0.8, y: 0.2, w: 0.1, h: 0.2 },
    { x: 0.5, y: 0.5, w: 0.9, h: 0.6 },
  ];
  it('never exposes an edge on any frame', () => {
    const violations: string[] = [];
    for (const focal of focals) {
      for (let seed = 0; seed <= 5; seed++) {
        for (const d of [30, 282, 420]) {
          const shots = plan(d, { focal, seed });
          for (let f = 0; f < d; f++) {
            const s = shotFrameAt(shots, f, focal);
            const limit = (s.scale - 1) * 50 + 1e-9;
            if (s.scale < 1 || Math.abs(s.txPct) > limit || Math.abs(s.tyPct) > limit) {
              violations.push(JSON.stringify({ focal, seed, d, f, s }));
            }
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('poster frame', () => {
  it('the first frame of a beat without a slam is sharp and full-frame', () => {
    for (let seed = 0; seed <= 10; seed++) {
      for (const focal of [null, person]) {
        const shots = plan(330, { slamIn: false, focal, seed });
        const s = shotFrameAt(shots, 0, focal);
        expect(s.blurX + s.blurY).toBe(0);
        expect(shots[0].scale).toBeLessThan(1.05); // wide, not a crop
      }
    }
  });
});

describe('slam', () => {
  const shots = plan(420);
  it('starts oversized and blurred', () => {
    const s = shotFrameAt(shots, 0, person);
    expect(s.scale).toBeGreaterThanOrEqual(shots[0].scale * 1.2);
    expect(s.blurY).toBeGreaterThan(0);
  });
  it('has landed and is sharp after slam + shake', () => {
    const s = shotFrameAt(shots, SLAM_FRAMES + SHAKE_FRAMES, person);
    expect(s.scale / shots[0].scale).toBeLessThan(MOVE_SCALE + 0.02);
    expect(s.blurX + s.blurY).toBe(0);
  });
  it('is skipped when slamIn is false', () => {
    const noSlam = plan(420, { slamIn: false });
    const s = shotFrameAt(noSlam, 0, person);
    expect(s.scale).toBeLessThanOrEqual(noSlam[0].scale * MOVE_SCALE + 1e-9);
    expect(s.blurX + s.blurY).toBe(0);
  });
});

describe('inner cuts', () => {
  const withEntry = (entry: string) => {
    for (let seed = 0; seed < 50; seed++) {
      const shots = plan(420, { seed });
      if (shots[1].entry === entry) return shots;
    }
    throw new Error('no seed for ' + entry);
  };

  it('hard punch pops the first frame of the shot', () => {
    const shots = withEntry('hardPunch');
    const pop = shotFrameAt(shots, shots[1].from, person).scale;
    const later = shotFrameAt(shots, shots[1].from + 3, person).scale;
    expect(pop).toBeGreaterThan(later * 1.015);
  });

  it('whip blurs both sides of the cut, not mid-shot', () => {
    const shots = withEntry('whip');
    expect(shotFrameAt(shots, shots[1].from - 1, person).blurX).toBeGreaterThan(0);
    expect(shotFrameAt(shots, shots[1].from, person).blurX).toBeGreaterThan(0);
    const mid = shots[1].from + Math.floor(shots[1].durationInFrames / 2);
    expect(shotFrameAt(shots, mid, person).blurX).toBe(0);
  });
});

describe('whisk', () => {
  it('zooms through with blur on the last frame', () => {
    const shots = plan(420);
    const last = shots[shots.length - 1];
    const s = shotFrameAt(shots, 419, person);
    expect(s.scale).toBeGreaterThanOrEqual(last.scale * 1.2);
    expect(s.blurY).toBeGreaterThan(0);
  });
  it('is skipped when whiskOut is false', () => {
    const s = shotFrameAt(plan(420, { whiskOut: false }), 419, person);
    expect(s.blurX + s.blurY).toBe(0);
  });
});

describe('hold moves', () => {
  it('every move visibly changes the frame across the shot', () => {
    for (const move of HOLD_MOVES) {
      const a = holdMove(move, 0);
      const b = holdMove(move, 1);
      const scaleChange = Math.abs(b.m - a.m);
      const shift = Math.max(Math.abs(b.dx - a.dx), Math.abs(b.dy - a.dy));
      expect(scaleChange >= MOVE_SCALE - 1 - 1e-9 || shift >= 2 * MOVE_SHIFT * 100 - 1e-9).toBe(true);
    }
  });
  it('moves are eased: still at both ends, fastest mid-shot', () => {
    for (const move of HOLD_MOVES) {
      const v = (t: number) => {
        const p = holdMove(move, t);
        const q = holdMove(move, t + 0.01);
        return Math.abs(q.m - p.m) * 100 + Math.abs(q.dx - p.dx) + Math.abs(q.dy - p.dy);
      };
      expect(v(0)).toBeLessThan(v(0.49));
      expect(v(0.98)).toBeLessThan(v(0.49));
    }
  });
  it('a beat without a box still moves (never idle)', () => {
    const shots = plan(330, { focal: null, slamIn: false, whiskOut: false });
    const a = shotFrameAt(shots, 0, null);
    const b = shotFrameAt(shots, 329, null);
    const moved = Math.abs(b.scale - a.scale) / a.scale >= 0.05 || Math.abs(b.txPct - a.txPct) >= 4 || Math.abs(b.tyPct - a.tyPct) >= 4;
    expect(moved).toBe(true);
  });
});

describe('framing', () => {
  it('pulls toward the subject on the tight shot', () => {
    const right: Focal = { x: 0.65, y: 0.4, w: 0.15, h: 0.25 };
    const left: Focal = { x: 0.35, y: 0.4, w: 0.15, h: 0.25 };
    const r = plan(420, { focal: right });
    const l = plan(420, { focal: left });
    const mid = r[1].from + Math.floor(r[1].durationInFrames / 2);
    expect(shotFrameAt(r, mid, right).txPct).toBeLessThan(0);
    expect(shotFrameAt(l, mid, left).txPct).toBeGreaterThan(0);
  });
  it('is deterministic', () => {
    const shots = plan(420, { seed: 3 });
    expect(shotFrameAt(shots, 100, person)).toEqual(shotFrameAt(shots, 100, person));
  });
  it('the hold never pushes past the whisk window', () => {
    const shots = plan(330, { focal: null });
    const pre = shotFrameAt(shots, 330 - WHISK_FRAMES - 1, null);
    expect(pre.blurX + pre.blurY).toBe(0);
  });
});
