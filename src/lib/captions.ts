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

// The brand sign-off ends the last beat. It gets its own caption page (owner 2026-10-18: "its own line where it
// has breathing space"); the audio has a pause before it, so the page appears after a short blank.
export const SIGN_OFF_WORDS = ['this', 'is', 'third', 'rail', 'sports', 'sport', 'decoded'];
const bare = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '');

export const signOffStart = (words: WordTiming[]): number => {
  const n = SIGN_OFF_WORDS.length;
  if (words.length < n) return -1;
  const from = words.length - n;
  return words.slice(from).every((w, i) => bare(w.word) === SIGN_OFF_WORDS[i]) ? from : -1;
};

export const pageWords = (words: WordTiming[], perPage = WORDS_PER_PAGE): WordTiming[][] => {
  const cut = signOffStart(words);
  const body = cut >= 0 ? words.slice(0, cut) : words;
  const pages: WordTiming[][] = [];
  for (let i = 0; i < body.length; i += perPage) {
    pages.push(body.slice(i, i + perPage));
  }
  if (cut >= 0) pages.push(words.slice(cut));
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
