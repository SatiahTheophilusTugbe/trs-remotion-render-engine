import { describe, it, expect } from 'vitest';
import { CAPTION_TOP, CAPTION_TOP_MAX, FRAME_H } from './captionPlacement';
import { CREDIT_BOTTOM } from '../compositions/PhotoCredit';

describe('caption position (owner 2026-10-18, 2026-10-20)', () => {
  it('two caption lines from the lowest top still end above the platforms\' bottom overlay (~y 1620)', () => {
    expect(CAPTION_TOP_MAX + 2 * 60 * 1.15 + 16).toBeLessThanOrEqual(1620);
  });
  it('the photo credit sits above the caption on every beat, never on it', () => {
    expect(CREDIT_BOTTOM.broll).toBe(CREDIT_BOTTOM.avatar);
    expect(FRAME_H - CREDIT_BOTTOM.broll).toBeLessThan(CAPTION_TOP);
  });
});
