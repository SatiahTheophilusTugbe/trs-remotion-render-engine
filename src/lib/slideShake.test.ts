import { describe, it, expect } from 'vitest';
import {
  slideShakeState,
  SLIDE_OUT_FRAMES,
  SHAKE_FRAMES,
  SLIDE_REACH_PX,
} from './slideShake';

const D = 90;
const both = { slideOut: true, slideIn: true };

describe('slideShakeState (swept over every frame of a beat)', () => {
  it('is the identity for a beat with no impact cut on either side', () => {
    for (let f = 0; f < D; f++) {
      expect(slideShakeState(f, D, { slideOut: false, slideIn: false })).toEqual({
        x: 0, y: 0, rot: 0, scale: 1, flash: 0, darkPx: 0,
      });
    }
  });

  it('outgoing slides out monotonically over the last frames and is untouched before', () => {
    const start = D - SLIDE_OUT_FRAMES;
    let prev = 0;
    for (let f = 0; f < D; f++) {
      const s = slideShakeState(f, D, { slideOut: true, slideIn: false });
      if (f < start) expect(s.x).toBe(0);
      else {
        expect(s.x).toBeLessThan(prev);
        prev = s.x;
      }
      expect(Number.isFinite(s.x)).toBe(true);
    }
    expect(Math.abs(prev)).toBeCloseTo(SLIDE_REACH_PX, 5);
  });

  it('incoming shake amplitude decays monotonically to exactly 0 by SHAKE_FRAMES and no transform after', () => {
    expect(SHAKE_FRAMES).toBe(8);
    let prevAmp = Infinity;
    for (let f = 0; f < D - SLIDE_OUT_FRAMES; f++) {
      const s = slideShakeState(f, D, { slideOut: false, slideIn: true });
      const amp = s.scale - 1; // scale envelope carries the decay
      expect(amp).toBeLessThanOrEqual(prevAmp + 1e-12);
      prevAmp = amp;
      if (f >= SHAKE_FRAMES) {
        expect(s).toEqual({ x: 0, y: 0, rot: 0, scale: 1, flash: 0, darkPx: 0 });
      }
    }
    expect(slideShakeState(SHAKE_FRAMES, D, { slideOut: false, slideIn: true }).scale).toBe(1);
    expect(slideShakeState(SHAKE_FRAMES - 1, D, { slideOut: false, slideIn: true }).scale).toBeGreaterThan(1);
  });

  it('cut frame (incoming frame 0) is fully defined and shows no dark backdrop', () => {
    const s = slideShakeState(0, D, { slideOut: false, slideIn: true });
    for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true);
    expect(s.flash).toBeGreaterThan(0);
    // shake px never exposes more than a small sliver; scale punch covers it
    expect(s.darkPx).toBe(0);
  });

  it('at the cut, at most ONE of (last outgoing frame, first incoming frame) shows dark backdrop', () => {
    const last = slideShakeState(D - 1, D, { slideOut: true, slideIn: false });
    const first = slideShakeState(0, D, { slideOut: false, slideIn: true });
    expect([last.darkPx, first.darkPx].filter((d) => d > 0).length).toBeLessThanOrEqual(1);
  });

  it('shake stays within its bounds and is deterministic', () => {
    for (let f = 0; f < D; f++) {
      const a = slideShakeState(f, D, both);
      const b = slideShakeState(f, D, both);
      expect(a).toEqual(b);
      expect(Math.abs(a.y)).toBeLessThanOrEqual(14 + 1e-9);
      expect(a.flash).toBeGreaterThanOrEqual(0);
      expect(a.flash).toBeLessThanOrEqual(0.4);
    }
  });

  it('a beat with both in and out: shake window and slide-out never overlap on a normal-length beat', () => {
    for (let f = 0; f < D; f++) {
      const s = slideShakeState(f, D, both);
      const inShake = f < SHAKE_FRAMES;
      const outSlide = f >= D - SLIDE_OUT_FRAMES;
      expect(inShake && outSlide).toBe(false);
      if (!inShake && !outSlide) expect(s).toEqual({ x: 0, y: 0, rot: 0, scale: 1, flash: 0, darkPx: 0 });
    }
  });
});
