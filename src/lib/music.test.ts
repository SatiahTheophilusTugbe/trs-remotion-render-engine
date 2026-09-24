import { describe, it, expect } from 'vitest';
import { musicVolume, MUSIC_VOLUME } from './music';

describe('musicVolume', () => {
  const total = 300;
  const fps = 30;
  it('starts silent and ramps up over 1s', () => {
    expect(musicVolume(0, total, fps)).toBe(0);
    expect(musicVolume(15, total, fps)).toBeCloseTo(MUSIC_VOLUME / 2);
  });
  it('holds the production volume (0.045) in the middle', () => {
    expect(musicVolume(150, total, fps)).toBeCloseTo(0.045);
  });
  it('ramps down to silence at the end', () => {
    expect(musicVolume(285, total, fps)).toBeCloseTo(MUSIC_VOLUME / 2);
    expect(musicVolume(300, total, fps)).toBe(0);
  });
  it('never goes negative or above the peak', () => {
    expect(musicVolume(-5, total, fps)).toBe(0);
    expect(musicVolume(400, total, fps)).toBe(0);
    expect(musicVolume(150, total, fps, 0.1)).toBeCloseTo(0.1);
  });
});
