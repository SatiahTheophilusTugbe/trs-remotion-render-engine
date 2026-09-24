import type { WordTiming } from '../types/beat';

export const WORDS_PER_PAGE = 4;
export const CAPTION_BRIDGE_SECONDS = 0.25;

export const parseWordTimings = (raw: unknown): WordTiming[] => {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(
    (w: Partial<WordTiming> | null): w is WordTiming =>
      !!w &&
      typeof w.word === 'string' &&
      w.word.length > 0 &&
      typeof w.start === 'number' &&
      typeof w.end === 'number',
  );
};

export const pageWords = (words: WordTiming[], perPage = WORDS_PER_PAGE): WordTiming[][] => {
  const pages: WordTiming[][] = [];
  for (let i = 0; i < words.length; i += perPage) {
    pages.push(words.slice(i, i + perPage));
  }
  return pages;
};

// Real word timings leave 23-93 ms of silence between pages. Showing a page only
// until its last word ends makes captions blink off for 1-2 frames at every page
// change, so a page stays visible until the next one starts when the gap is short.
// Real pauses (>= CAPTION_BRIDGE_SECONDS) still go blank.
export const pageAt = (pages: WordTiming[][], tSeconds: number): WordTiming[] | null => {
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const from = page[0].start;
    const lastEnd = page[page.length - 1].end;
    const next = pages[i + 1];
    const to = next && next[0].start - lastEnd < CAPTION_BRIDGE_SECONDS ? next[0].start : lastEnd;
    if (tSeconds >= from && tSeconds < to) return page;
  }
  return null;
};

export const activeWordIndex = (page: WordTiming[], tSeconds: number): number => {
  let index = -1;
  for (let i = 0; i < page.length; i++) {
    if (page[i].start <= tSeconds) index = i;
  }
  return index;
};
