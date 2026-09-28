// Pure fit math for the odometer stat card: pick the largest font size (<= max, >= min) so the
// full formatted value (prefix + number + suffix) fits the card width. No DOM measuring, so it is
// deterministic and unit-swept.
//
// Glyph widths are CONSERVATIVE upper bounds for Montserrat Bold (700), in em:
//   digits      0.70  (tabular digit advance is ~0.68; also the odometer drum cell width)
//   . ,         0.32  (odometer separator cell width)
//   space       0.30
//   uppercase   0.90  (M/W reach ~0.95, average caps ~0.72; 0.90 covers the wide ones)
//   lowercase   0.78
//   other       0.80  ($ % + - etc.)
// plus a 4% FIT_SAFETY factor on the fitted width. Over-estimating only costs a slightly smaller
// number; under-estimating would clip, which is the bug this replaces.
export const DIGIT_EM = 0.7;
export const SEP_EM = 0.32;
const SPACE_EM = 0.3;
const UPPER_EM = 0.9;
const LOWER_EM = 0.78;
const OTHER_EM = 0.8;
export const FIT_SAFETY = 1.04;

// Prefix/suffix render at this fraction of the digit size (as in the prototype).
export const AFFIX_RATIO = 0.5;
// Gap between number and affix, in em of the digit size.
export const AFFIX_GAP_EM = 0.05;

// Card geometry (1080 wide frame): panel max 960, 40px side padding, 3px border each side.
export const STAT_PANEL_MAX_W = 960;
export const STAT_PAD_X = 40;
export const STAT_BORDER = 3;
export const STAT_INNER_W = STAT_PANEL_MAX_W - 2 * STAT_PAD_X - 2 * STAT_BORDER; // 874
export const STAT_MAX_FONT = 230;
export const STAT_MIN_FONT = 70;

export const LABEL_MAX_CHARS = 40;
export const LABEL_MAX_FONT = 56;
export const LABEL_ONE_LINE_MIN_FONT = 44;
export const LABEL_MIN_FONT = 30;
export const LABEL_TRACKING_EM = 0.08;
// Two lines never pack perfectly (word breaks), so budget 1.8 rows of width.
const LABEL_TWO_LINE_BUDGET = 1.8;

const charEm = (ch: string): number => {
  if (ch >= '0' && ch <= '9') return DIGIT_EM;
  if (ch === '.' || ch === ',') return SEP_EM;
  if (ch === ' ') return SPACE_EM;
  if (ch >= 'A' && ch <= 'Z') return UPPER_EM;
  if (ch >= 'a' && ch <= 'z') return LOWER_EM;
  return OTHER_EM;
};

export const textWidthEm = (text: string): number => {
  let w = 0;
  for (const ch of text) w += charEm(ch);
  return w;
};

const clampFit = (widthEm: number, maxWidthPx: number, maxFontPx: number, minFontPx: number): number => {
  if (widthEm <= 0) return maxFontPx;
  const raw = Math.floor(maxWidthPx / (widthEm * FIT_SAFETY));
  return Math.min(maxFontPx, Math.max(minFontPx, raw));
};

// Whole string treated as one run at a single size (upper bound for any rendering of it).
export const fitFontSize = (
  text: string,
  maxWidthPx: number,
  maxFontPx: number,
  minFontPx: number,
): number => clampFit(textWidthEm(text), maxWidthPx, maxFontPx, minFontPx);

// Layout width (em of the digit size) of the odometer row: fixed number template at full size,
// prefix/suffix at AFFIX_RATIO of it, plus the gaps.
export const statWidthEm = (numberText: string, prefix = '', suffix = ''): number =>
  textWidthEm(numberText) +
  AFFIX_RATIO * (textWidthEm(prefix) + textWidthEm(suffix)) +
  AFFIX_GAP_EM * ((prefix ? 1 : 0) + (suffix ? 1 : 0));

export const fitStatFontSize = (
  numberText: string,
  prefix: string,
  suffix: string,
  maxWidthPx: number,
  maxFontPx: number,
  minFontPx: number,
): number => clampFit(statWidthEm(numberText, prefix, suffix), maxWidthPx, maxFontPx, minFontPx);

// Label (rendered uppercase with tracking): one line if it fits at >= 44px, else up to two lines.
export const fitLabel = (label: string, maxWidthPx: number): { fontSize: number; lines: 1 | 2 } => {
  const upper = label.toUpperCase();
  const widthEm = textWidthEm(upper) + upper.length * LABEL_TRACKING_EM;
  if (widthEm * LABEL_ONE_LINE_MIN_FONT * FIT_SAFETY <= maxWidthPx) {
    return { fontSize: clampFit(widthEm, maxWidthPx, LABEL_MAX_FONT, LABEL_ONE_LINE_MIN_FONT), lines: 1 };
  }
  return {
    fontSize: clampFit(widthEm, maxWidthPx * LABEL_TWO_LINE_BUDGET, LABEL_ONE_LINE_MIN_FONT, LABEL_MIN_FONT),
    lines: 2,
  };
};

// Width (em of the digit size) of the hidden LEADING odometer columns (leading-zero digits and the
// commas that follow only hidden digits). The prefix is translated right by this much so it hugs
// the first visible digit while the number itself stays fixed (right-aligned, exactly centred at
// the end). `visible` is the per-template-character mask from columnVisibility.
export const leadingHiddenEm = (template: string, visible: boolean[]): number => {
  let em = 0;
  for (let i = 0; i < template.length; i++) {
    if (visible[i]) break;
    em += charEm(template[i]);
  }
  return em;
};
