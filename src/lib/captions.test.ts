import { describe, it, expect } from 'vitest';
import { parseWordTimings, pageWords, pageAt, activeWordIndex } from './captions';
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
  it('returns null in the gap between pages and after the last word', () => {
    expect(pageAt(pages, 1.74)).toBeNull(); // page 0 ends 1.718, page 1 starts 1.765
    expect(pageAt(pages, 3.0)).toBeNull();
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
