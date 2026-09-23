import { describe, it, expect } from 'vitest';
import { kenBurnsScale } from './kenburns';

describe('kenBurnsScale', () => {
  it('starts at the start scale on frame 0', () => {
    expect(kenBurnsScale(0, 60)).toBe(1);
  });

  it('reaches the end scale exactly at the last frame', () => {
    expect(kenBurnsScale(60, 60)).toBeCloseTo(1.08);
  });

  it('is halfway between start and end scale at the midpoint', () => {
    expect(kenBurnsScale(30, 60)).toBeCloseTo(1.04);
  });

  it('clamps to the end scale if frame exceeds duration (never overshoots)', () => {
    expect(kenBurnsScale(90, 60)).toBeCloseTo(1.08);
  });

  it('supports custom start/end scales', () => {
    expect(kenBurnsScale(0, 60, 1.1, 1.0)).toBeCloseTo(1.1);
    expect(kenBurnsScale(60, 60, 1.1, 1.0)).toBeCloseTo(1.0);
  });
});
