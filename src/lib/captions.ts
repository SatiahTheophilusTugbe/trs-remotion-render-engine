import type { WordTiming } from '../types/beat';

export const WORDS_PER_PAGE = 4;

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

export const pageAt = (pages: WordTiming[][], tSeconds: number): WordTiming[] | null => {
  for (const page of pages) {
    if (tSeconds >= page[0].start && tSeconds < page[page.length - 1].end) return page;
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
