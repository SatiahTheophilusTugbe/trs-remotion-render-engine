import { describe, it, expect } from 'vitest';
import {
  slideShakeState,
  limeExposurePx,
  SLIDE_OUT_FRAMES,
  SLIDE_IN_FRAMES,
  SHAKE_FRAMES,
  MIN_SHAKE_BEAT_FRAMES,
  SLIDE_REACH_PX,
  FRAME_W,
} from './slideShake';

const D = 90;
const ID = { x: 0, y: 0, rot: 0, scale: 1, flash: 0, limePx: 0 };
const IN = { slideOut: false, slideIn: true };
const OUT = { slideOut: true, slideIn: false };
const BOTH = { slideOut: true, slideIn: true };

describe('slideShakeState (swept over every frame)', () => {
  it('is identity everywhere for a beat with no impact cut', () => {
    for (let f = 0; f < D; f++) expect(slideShakeState(f, D, { slideOut: false, slideIn: false })).toEqual(ID);
  });

  it('outgoing: identity before the window, strictly monotone leftwards inside, ends at full reach', () => {
    const start = D - SLIDE_OUT_FRAMES;
    let prev = 0;
    for (let f = 0; f < D; f++) {
      const s = slideShakeState(f, D, OUT);
      if (f < start) expect(s).toEqual(ID);
      else {
        expect(s.x).toBeLessThan(prev);
        prev = s.x;
      }
    }
    expect(slideShakeState(start - 1, D, OUT)).toEqual(ID);
    expect(prev).toBeCloseTo(-SLIDE_REACH_PX, 5);
  });

  it('incoming: offset strictly decreases over the slide-in, then shake, identity after', () => {
    let prev = Infinity;
    for (let f = 0; f < SLIDE_IN_FRAMES; f++) {
      const s = slideShakeState(f, D, IN);
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(prev);
      prev = s.x;
    }
    expect(slideShakeState(0, D, IN).x).toBeCloseTo(SLIDE_REACH_PX, 5);
    expect(Math.abs(slideShakeState(SLIDE_IN_FRAMES, D, IN).x)).toBeLessThanOrEqual(14);
    for (let f = SLIDE_IN_FRAMES + SHAKE_FRAMES; f < D; f++) expect(slideShakeState(f, D, IN)).toEqual(ID);
  });

  it('shake envelope decays monotonically and is exactly identity SHAKE_FRAMES after landing', () => {
    let prev = Infinity;
    for (let e = 0; e < SHAKE_FRAMES; e++) {
      const s = slideShakeState(SLIDE_IN_FRAMES + e, D, IN);
      expect(s.scale - 1).toBeLessThanOrEqual(prev + 1e-12);
      expect(s.scale).toBeGreaterThan(1);
      prev = s.scale - 1;
    }
    expect(slideShakeState(SLIDE_IN_FRAMES + SHAKE_FRAMES, D, IN)).toEqual(ID);
  });

  it('lime strip + beat cover exactly 100% of the width every frame; strip only during slides', () => {
    for (const opts of [IN, OUT, BOTH]) {
      for (let f = 0; f < D; f++) {
        const s = slideShakeState(f, D, opts);
        const beatPx = FRAME_W - s.limePx;
        expect(beatPx + s.limePx).toBe(FRAME_W);
        expect(s.limePx).toBeGreaterThanOrEqual(0);
        expect(beatPx).toBeGreaterThanOrEqual(0);
        expect(s.limePx).toBeCloseTo(limeExposurePx(s), 9);
        const slideFrame = (f < SLIDE_IN_FRAMES && opts.slideIn) || (f >= D - SLIDE_OUT_FRAMES && opts.slideOut);
        if (slideFrame) expect(s.limePx).toBeGreaterThan(0);
        else expect(s.limePx).toBe(0); // shake never exposes backdrop (scale punch hides it)
      }
    }
  });

  it('nothing outside the effect window has any transform', () => {
    for (let f = 0; f < D; f++) {
      const inWin = f < SLIDE_IN_FRAMES + SHAKE_FRAMES || f >= D - SLIDE_OUT_FRAMES;
      if (!inWin) expect(slideShakeState(f, D, BOTH)).toEqual(ID);
    }
    expect(SLIDE_OUT_FRAMES + SLIDE_IN_FRAMES + SHAKE_FRAMES).toBe(MIN_SHAKE_BEAT_FRAMES);
  });

  it('lime-dominated at the cut: last outgoing and first incoming frames both show a full-reach strip', () => {
    expect(slideShakeState(D - 1, D, OUT).limePx).toBeCloseTo(SLIDE_REACH_PX, 5);
    expect(slideShakeState(0, D, IN).limePx).toBeCloseTo(SLIDE_REACH_PX, 5);
  });

  it('is deterministic and finite', () => {
    for (let f = 0; f < D; f++) {
      const a = slideShakeState(f, D, BOTH);
      expect(a).toEqual(slideShakeState(f, D, BOTH));
      for (const v of Object.values(a)) expect(Number.isFinite(v)).toBe(true);
      expect(a.flash).toBeLessThanOrEqual(0.4);
    }
  });

  it('short beats degrade gracefully: no shake below 17 frames, always finite', () => {
    for (let d = 1; d < MIN_SHAKE_BEAT_FRAMES + 3; d++) {
      for (let f = 0; f < d; f++) {
        const s = slideShakeState(f, d, BOTH);
        for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true);
        if (d < MIN_SHAKE_BEAT_FRAMES) {
          expect(s.rot).toBe(0);
          expect(s.y).toBe(0);
          expect(s.flash).toBe(0);
        }
        expect(s.limePx).toBeLessThanOrEqual(SLIDE_REACH_PX + 1e-9);
      }
    }
    for (let f = 0; f < MIN_SHAKE_BEAT_FRAMES; f++) {
      const inShake = f >= SLIDE_IN_FRAMES && f < SLIDE_IN_FRAMES + SHAKE_FRAMES;
      const outSlide = f >= MIN_SHAKE_BEAT_FRAMES - SLIDE_OUT_FRAMES;
      expect(inShake && outSlide).toBe(false);
    }
  });
});
