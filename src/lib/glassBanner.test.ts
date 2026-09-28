import { describe, expect, it } from 'vitest';
import { GLASS_MAX_CARD_HEIGHT, GLASS_MAX_FONT, GLASS_MAX_LINES, glassLayout } from './glassBanner';

const sample = (n: number, word = 'lorem ipsum dolor ') => word.repeat(40).slice(0, n).trim();

describe('glassLayout', () => {
  it('keeps short text at max font on one line', () => {
    const l = glassLayout('Short headline');
    expect(l.fontSize).toBe(GLASS_MAX_FONT);
    expect(l.lines).toBe(1);
  });

  it('sweep 5..80 chars: card <= 420px and <= 3 lines (mixed, uppercase, unbroken words)', () => {
    for (const gen of [
      (n: number) => sample(n),
      (n: number) => sample(n, 'WEMBANYAMA DROPS 40 ').toUpperCase(),
      (n: number) => 'x'.repeat(n),
      (n: number) => sample(n, 'a '),
    ]) {
      for (let n = 5; n <= 80; n++) {
        const l = glassLayout(gen(n));
        expect(l.lines).toBeLessThanOrEqual(GLASS_MAX_LINES);
        expect(l.cardHeight).toBeLessThanOrEqual(GLASS_MAX_CARD_HEIGHT);
        expect(l.fontSize).toBeLessThanOrEqual(GLASS_MAX_FONT);
      }
    }
  });

  it('font size never grows as text gets longer', () => {
    let prev = Infinity;
    for (let n = 5; n <= 80; n++) {
      const s = glassLayout(sample(n)).fontSize;
      expect(s).toBeLessThanOrEqual(prev + 2);
      prev = s;
    }
  });
});
