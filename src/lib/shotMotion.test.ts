import { describe, it, expect } from 'vitest';
import { planShots, type PlanOptions } from './shots';
import { SHAKE_FRAMES, SLAM_FRAMES, WHISK_FRAMES, shotFrameAt } from './shotMotion';
import type { Focal } from '../types/beat';

const FPS = 30;
const plan = (d: number, o: Partial<PlanOptions> = {}) =>
  planShots(d, FPS, { focal: { x: 0.5, y: 0.5 }, seed: 0, slamIn: true, whiskOut: true, ...o });

describe('shotFrameAt edge safety', () => {
  const focals: (Focal | null)[] = [null, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.2 }];
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

describe('slam', () => {
  const shots = plan(420);
  it('starts oversized and blurred', () => {
    const s = shotFrameAt(shots, 0, { x: 0.5, y: 0.5 });
    expect(s.scale).toBeGreaterThanOrEqual(shots[0].scale * 1.2);
    expect(s.blurY).toBeGreaterThan(0);
  });
  it('has landed and settled after slam + shake', () => {
    const s = shotFrameAt(shots, SLAM_FRAMES + SHAKE_FRAMES, { x: 0.5, y: 0.5 });
    expect(Math.abs(s.scale / shots[0].scale - 1)).toBeLessThan(0.04);
    expect(s.blurX + s.blurY).toBe(0);
  });
  it('is skipped when slamIn is false', () => {
    const noSlam = plan(420, { slamIn: false });
    const s = shotFrameAt(noSlam, 0, { x: 0.5, y: 0.5 });
    expect(s.scale).toBeLessThanOrEqual(noSlam[0].scale * 1.01);
    expect(s.blurX + s.blurY).toBe(0);
  });
});

describe('inner cuts', () => {
  // Find seeds whose second shot uses each entry style.
  const withEntry = (entry: string) => {
    for (let seed = 0; seed < 50; seed++) {
      const shots = plan(420, { seed });
      if (shots[1].entry === entry) return shots;
    }
    throw new Error('no seed for ' + entry);
  };
  const focal = { x: 0.5, y: 0.5 };

  it('hard punch pops the first frame of the shot', () => {
    const shots = withEntry('hardPunch');
    expect(shotFrameAt(shots, shots[1].from, focal).scale).toBeGreaterThan(shots[1].scale * 1.02);
  });

  it('whip blurs both sides of the cut, not mid-shot', () => {
    const shots = withEntry('whip');
    expect(shotFrameAt(shots, shots[1].from - 1, focal).blurX).toBeGreaterThan(0);
    expect(shotFrameAt(shots, shots[1].from, focal).blurX).toBeGreaterThan(0);
    const mid = shots[1].from + Math.floor(shots[1].durationInFrames / 2);
    expect(shotFrameAt(shots, mid, focal).blurX).toBe(0);
  });
});

describe('whisk', () => {
  it('zooms through with blur on the last frame', () => {
    const shots = plan(420);
    const last = shots[shots.length - 1];
    const s = shotFrameAt(shots, 419, { x: 0.5, y: 0.5 });
    expect(s.scale).toBeGreaterThanOrEqual(last.scale * 1.2);
    expect(s.blurY).toBeGreaterThan(0);
  });
  it('is skipped when whiskOut is false', () => {
    const s = shotFrameAt(plan(420, { whiskOut: false }), 419, { x: 0.5, y: 0.5 });
    expect(s.blurX + s.blurY).toBe(0);
  });
});

describe('framing', () => {
  it('no focal: centred, no translation while holding', () => {
    const shots = plan(330, { focal: null });
    const s = shotFrameAt(shots, 165, null);
    expect(s.txPct).toBe(0);
    expect(s.tyPct).toBe(0);
  });
  it('pulls toward the focal point on a tight shot', () => {
    const right = { x: 0.8, y: 0.5 };
    const left = { x: 0.2, y: 0.5 };
    const shots = plan(420, { focal: right });
    const mid = shots[1].from + Math.floor(shots[1].durationInFrames / 2);
    expect(shotFrameAt(shots, mid, right).txPct).toBeLessThan(0);
    expect(shotFrameAt(plan(420, { focal: left }), mid, left).txPct).toBeGreaterThan(0);
  });
  it('holds instead of drifting', () => {
    const shots = plan(330, { focal: null });
    const a = shotFrameAt(shots, 165, null).scale;
    const b = shotFrameAt(shots, 330 - WHISK_FRAMES - 1, null).scale;
    expect(Math.abs(b - a) / a).toBeLessThan(0.01);
  });
  it('is deterministic', () => {
    const shots = plan(420, { seed: 3 });
    expect(shotFrameAt(shots, 100, { x: 0.3, y: 0.7 })).toEqual(shotFrameAt(shots, 100, { x: 0.3, y: 0.7 }));
  });
});
