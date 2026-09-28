// Pure layout math for the glass banner: pick the largest font size (<= GLASS_MAX_FONT)
// whose estimated word-wrapped line count fits GLASS_MAX_LINES, so the card never grows tall.
export const GLASS_CARD_W = 960;
export const GLASS_PAD_X = 48 + 64; // right + left (left leaves room for the accent bar)
export const GLASS_PAD_Y = 80; // top + bottom
export const GLASS_TEXT_W = GLASS_CARD_W - GLASS_PAD_X - 2; // minus hairline border
export const GLASS_MAX_FONT = 54;
export const GLASS_MIN_FONT = 32;
export const GLASS_MAX_LINES = 3;
export const GLASS_LINE_HEIGHT = 1.2;
export const GLASS_MAX_CARD_HEIGHT = 420;
// Conservative average glyph width for Montserrat Bold (mixed case ~0.58em; uppercase runs wider).
const CHAR_EM = 0.66;

export const estimateLines = (text: string, fontSize: number): number => {
  const perLine = Math.max(1, Math.floor(GLASS_TEXT_W / (fontSize * CHAR_EM)));
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  let lines = 1;
  let cur = 0;
  for (const w of words) {
    let len = w.length;
    // A word longer than a whole line is broken across lines by the browser.
    while (len > perLine) {
      if (cur > 0) {
        lines += 1;
        cur = 0;
      }
      lines += Math.floor((len - 1) / perLine);
      len = ((len - 1) % perLine) + 1;
    }
    if (cur === 0) cur = len;
    else if (cur + 1 + len <= perLine) cur += 1 + len;
    else {
      lines += 1;
      cur = len;
    }
  }
  return lines;
};

export const glassLayout = (text: string): { fontSize: number; lines: number; cardHeight: number } => {
  for (let size = GLASS_MAX_FONT; size >= GLASS_MIN_FONT; size -= 2) {
    const lines = estimateLines(text, size);
    if (lines <= GLASS_MAX_LINES) {
      return { fontSize: size, lines, cardHeight: Math.ceil(lines * size * GLASS_LINE_HEIGHT) + GLASS_PAD_Y };
    }
  }
  const size = GLASS_MIN_FONT;
  return {
    fontSize: size,
    lines: GLASS_MAX_LINES,
    cardHeight: Math.ceil(GLASS_MAX_LINES * size * GLASS_LINE_HEIGHT) + GLASS_PAD_Y,
  };
};
