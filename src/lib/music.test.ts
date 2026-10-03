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

import {
  trackGain,
  speechRanges,
  duckFactor,
  musicLevel,
  GAP_LIFT,
  MUSIC_PEAK_UNDER_SPEECH_LUFS,
  TRACK_PEAK_LUFS,
} from './music';

const dB = (v: number) => 20 * Math.log10(v);

describe('trackGain (loudness matching)', () => {
  it('puts every known track loudest moment at the same level under speech', () => {
    for (const [name, peak] of Object.entries(TRACK_PEAK_LUFS)) {
      const url = 'https://raw.githubusercontent.com/x/trs_audio/main/' + name;
      expect(peak + dB(trackGain(url))).toBeCloseTo(MUSIC_PEAK_UNDER_SPEECH_LUFS, 5);
    }
  });
  it('keeps the approved Fever level for track 04 (about 0.045)', () => {
    expect(trackGain('https://h/trs_track_04.mp3')).toBeCloseTo(0.0442, 3);
  });
  it('gives an unknown track less gain than the loudest known track (never louder)', () => {
    const unknown = trackGain('https://h/brand_new.mp3');
    const minKnown = Math.min(...Object.keys(TRACK_PEAK_LUFS).map((n) => trackGain('https://h/' + n)));
    expect(unknown).toBeLessThan(minKnown);
  });
  it('ignores query strings', () => {
    expect(trackGain('https://h/trs_track_02.mp3?x=1')).toBeCloseTo(trackGain('https://h/trs_track_02.mp3'));
  });
});

describe('speechRanges', () => {
  const fps = 30;
  it('offsets word timings by each beat start and merges short pauses', () => {
    const beats = [
      { duration_sec: 2, word_timings: [{ word: 'a', start: 0, end: 0.5 }, { word: 'b', start: 0.7, end: 1.5 }] },
      { duration_sec: 3, word_timings: JSON.stringify([{ word: 'c', start: 0.2, end: 1 }, { word: 'd', start: 2.2, end: 2.8 }]) },
    ];
    const r = speechRanges(beats, fps);
    // beat 1: 0-1.5; beat 2 starts at 2s: 2.2-3.0 and 4.2-4.8 (1.2s pause stays separate)
    expect(r.map((x) => [x.start, x.end].map((v) => Math.round(v * 10) / 10))).toEqual([
      [0, 1.5],
      [2.2, 3],
      [4.2, 4.8],
    ]);
  });
  it('treats a beat without word timings as speech for its whole length', () => {
    const r = speechRanges([{ duration_sec: 2 }, { duration_sec: 1, word_timings: 'bad json' }], fps);
    expect(r).toEqual([{ start: 0, end: 3 }]);
  });
});

describe('duckFactor', () => {
  const ranges = [{ start: 1, end: 2 }, { start: 5, end: 6 }];
  it('is 1 (ducked) during speech', () => {
    expect(duckFactor(1.5, ranges)).toBe(1);
    expect(duckFactor(5, ranges)).toBe(1);
  });
  it('lifts fully in a long pause and is continuous at the edges', () => {
    expect(duckFactor(3.5, ranges)).toBeCloseTo(GAP_LIFT);
    expect(duckFactor(2.25, ranges)).toBeCloseTo(1 + (GAP_LIFT - 1) * 0.5); // half-way through release
    expect(duckFactor(4.875, ranges)).toBeCloseTo(1 + (GAP_LIFT - 1) * 0.5); // half-way through attack
  });
  it('never exceeds GAP_LIFT or drops below 1', () => {
    for (let t = -2; t < 9; t += 0.05) {
      const v = duckFactor(t, ranges);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(GAP_LIFT + 1e-9);
    }
  });
});

describe('musicLevel', () => {
  it('is the loudness-matched gain under speech and the lifted gain in pauses, with fades', () => {
    const g = 0.04;
    const ranges = [{ start: 0, end: 4 }];
    expect(musicLevel(0, 300, 30, g, ranges)).toBe(0);
    expect(musicLevel(60, 300, 30, g, ranges)).toBeCloseTo(g);
    expect(musicLevel(240, 300, 30, g, ranges)).toBeCloseTo(g * GAP_LIFT);
    expect(musicLevel(300, 300, 30, g, ranges)).toBe(0);
    expect(musicLevel(60, 300, 30, g, null)).toBeCloseTo(g);
  });
});
