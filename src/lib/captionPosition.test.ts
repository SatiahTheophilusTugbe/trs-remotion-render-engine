import { describe, it, expect } from 'vitest';
import { CAPTION_BOTTOM } from '../compositions/CaptionLayer';
import { CREDIT_BOTTOM } from '../compositions/PhotoCredit';

describe('caption position (owner 2026-10-18)', () => {
  it('captions sit at the same height on every beat, where they show in the mobile feed preview', () => {
    expect(CAPTION_BOTTOM.broll).toBe(CAPTION_BOTTOM.avatar);
  });
  it('the photo credit sits just above the caption block, the same on every beat', () => {
    // caption block: up to two 60px lines (~150px) above its bottom edge; the credit sits above that.
    expect(CREDIT_BOTTOM.broll).toBe(CREDIT_BOTTOM.avatar);
    expect(CREDIT_BOTTOM.broll).toBeGreaterThanOrEqual(CAPTION_BOTTOM.broll + 150);
  });
});
