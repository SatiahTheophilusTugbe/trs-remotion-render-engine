import { describe, it, expect } from 'vitest';
import {
  parseWordTimings,
  pageWords,
  pageAt,
  activeWordIndex,
  CAPTION_BRIDGE_SECONDS,
} from './captions';
import ballmer from '../fixtures/real-story-ballmer.json';
import type { WordTiming } from '../types/beat';

const words: WordTiming[] = [
  { word: 'Ballmer', start: 0, end: 0.36 },
  { word: 'blinks,', start: 0.406, end: 0.906 },
  { word: 'Torre', start: 0.964, end: 1.312 },
  { word: 'circles', start: 1.37, end: 1.718 },
  { word: 'the', start: 1.765, end: 1.834 },
  { word: 'Lakers,', start: 1.881, end: 2.357 },
  { word: 'and', start: 2.38, end: 2.508 },
  { word: 'a', start: 2.554, end: 2.577 },
  { word: 'former', start: 2.624, end: 2.891 },
];

describe('parseWordTimings', () => {
  it('parses the JSON string exactly as the pipeline stores it', () => {
    expect(parseWordTimings(JSON.stringify(words))).toEqual(words);
  });
  it('passes an already-parsed array through', () => {
    expect(parseWordTimings(words)).toEqual(words);
  });
  it('returns [] for null, undefined, invalid JSON, and non-arrays (never throws)', () => {
    expect(parseWordTimings(null)).toEqual([]);
    expect(parseWordTimings(undefined)).toEqual([]);
    expect(parseWordTimings('not json')).toEqual([]);
    expect(parseWordTimings('{"word":"x"}')).toEqual([]);
    expect(parseWordTimings(42)).toEqual([]);
  });
  it('drops malformed entries but keeps valid ones (production filters the same way)', () => {
    const raw = JSON.stringify([
      { word: 'ok', start: 0, end: 1 },
      { word: '', start: 1, end: 2 },
      { word: 'noEnd', start: 2 },
      null,
      { word: 'ok2', start: 3, end: 4 },
    ]);
    expect(parseWordTimings(raw).map((w) => w.word)).toEqual(['ok', 'ok2']);
  });
});

describe('pageWords', () => {
  it('groups into fixed pages of 4 words (production CUE_WORD_COUNT)', () => {
    expect(pageWords(words).map((p) => p.length)).toEqual([4, 4, 1]);
  });
  it('returns [] for no words', () => {
    expect(pageWords([])).toEqual([]);
  });
});

describe('pageAt', () => {
  const pages = pageWords(words);
  it('returns the page whose [first.start, last.end) contains t', () => {
    expect(pageAt(pages, 0)).toBe(pages[0]);
    expect(pageAt(pages, 1.5)).toBe(pages[0]);
    expect(pageAt(pages, 2.0)).toBe(pages[1]);
    expect(pageAt(pages, 2.7)).toBe(pages[2]);
  });
  it('bridges tiny gaps between pages and is null after the last word', () => {
    expect(pageAt(pages, 1.74)).toBe(pages[0]); // 47 ms gap, page 1 starts 1.765
    expect(pageAt(pages, 3.0)).toBeNull();
  });
  it('a real pause (gap >= CAPTION_BRIDGE_SECONDS) stays blank', () => {
    const w = (i: number, start: number, end: number): WordTiming => ({ word: `w${i}`, start, end });
    const synthetic = [
      w(1, 0, 0.25),
      w(2, 0.25, 0.5),
      w(3, 0.5, 0.75),
      w(4, 0.75, 1.0),
      w(5, 1.325, 1.5),
      w(6, 1.5, 1.7),
      w(7, 1.7, 1.9),
      w(8, 1.9, 2.1),
    ];
    const p = pageWords(synthetic);
    expect(pageAt(p, 1.1)).toBeNull();
    expect(pageAt(p, 1.325)).toBe(p[1]);
  });
  it('real ElevenLabs data: no 1-2 frame caption blinks at 30 or 25 fps', () => {
    for (const beat of ballmer as { word_timings: string }[]) {
      const p = pageWords(parseWordTimings(beat.word_timings));
      const first = p[0][0].start;
      const last = p[p.length - 1][p[p.length - 1].length - 1].end;
      for (const fps of [30, 25]) {
        const runs: number[] = [];
        let run = 0;
        for (let f = Math.ceil(first * fps); f / fps <= last; f++) {
          if (pageAt(p, f / fps) === null) run++;
          else if (run > 0) {
            runs.push(run);
            run = 0;
          }
        }
        if (run > 0) runs.push(run);
        for (const r of runs) {
          expect(r).toBeGreaterThanOrEqual(Math.floor(CAPTION_BRIDGE_SECONDS * fps));
        }
      }
    }
  });
});

describe('activeWordIndex', () => {
  const page0 = pageWords(words)[0];
  it('highlights the last word whose start time has passed', () => {
    expect(activeWordIndex(page0, 0.1)).toBe(0);
    expect(activeWordIndex(page0, 0.5)).toBe(1);
    expect(activeWordIndex(page0, 1.4)).toBe(3);
  });
});
