// src/lib/thumbnail.test.ts
import { describe, it, expect } from 'vitest';
import { thumbLayout, fitFontSize, validateThumbnailInput, SAFE_TOP, SAFE_BOTTOM, BAND_TOP } from './thumbnail';

describe('thumbLayout', () => {
  it('is B only with a value and a label', () => {
    expect(thumbLayout({ value: '115', label: 'BEST OFFENSE EVER' })).toBe('B');
    expect(thumbLayout({ value: '115', label: '' })).toBe('A');
    expect(thumbLayout(null)).toBe('A');
    expect(thumbLayout(undefined)).toBe('A');
  });
});

describe('fitFontSize', () => {
  it('shrinks long text and clamps to the range', () => {
    expect(fitFontSize('GO', 960, 150, 70)).toBe(150);
    const long = fitFontSize('CHAMPIONSHIP OR BUST', 960, 150, 70);
    expect(long).toBeLessThan(150);
    expect(long).toBeGreaterThanOrEqual(70);
    expect(fitFontSize('X'.repeat(80), 960, 150, 70)).toBe(70);
  });
});

describe('safe area', () => {
  it('keeps the band inside the Instagram 3:4 crop', () => {
    expect(BAND_TOP).toBeGreaterThanOrEqual(SAFE_TOP);
    expect(BAND_TOP + 420).toBeLessThanOrEqual(SAFE_BOTTOM);
  });
});

describe('validateThumbnailInput', () => {
  const base = { photo_url: 'https://x/p.jpg', line1: 'best offense ever.', line2: 'gone in round one now', leagueBadge: 'WNBA' };
  it('normalises lines to 3 upper-case words', () => {
    const r = validateThumbnailInput(base);
    expect(r.ok && r.props.line1).toBe('BEST OFFENSE EVER.');
    expect(r.ok && r.props.line2).toBe('GONE IN ROUND');
  });
  it('requires an https photo and a line1', () => {
    expect(validateThumbnailInput({ ...base, photo_url: 'http://x/p.jpg' }).ok).toBe(false);
    expect(validateThumbnailInput({ ...base, line1: '' }).ok).toBe(false);
  });
  it('keeps a well-formed stat and drops a malformed one', () => {
    const good = validateThumbnailInput({ ...base, stat: { value: '115', label: 'best offense ever' } });
    expect(good.ok && good.props.stat).toEqual({ value: '115', label: 'BEST OFFENSE EVER' });
    for (const value of ['abc', '1234567', '']) {
      const r = validateThumbnailInput({ ...base, stat: { value, label: 'x' } });
      expect(r.ok && r.props.stat).toBeNull();
    }
  });
  it('drops an invalid focal box but keeps the thumbnail', () => {
    const r = validateThumbnailInput({ ...base, focal: { x: 2, y: 0.3 } });
    expect(r.ok && r.props.focal).toBeNull();
  });
});
