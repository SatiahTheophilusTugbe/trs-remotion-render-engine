import { describe, it, expect } from 'vitest';
import { AVATAR_BOX, captionFontSize, CAPTION_GAP, CAPTION_TOP, CAPTION_TOP_MAX, captionPlacement, photoFrameBottom } from './captionPlacement';
import type { Beat } from '../types/beat';

const groupFocal = { x: 0.5, y: 0.5, w: 0.9, h: 0.6 }; // wide group box -> letterbox on a 16:9 photo
const base = { narration_line: 'x', duration_sec: 8, beat_index: 0, photo_url: 'https://p/a.jpg' };
const broll = (extra: object = {}): Beat => ({ ...base, type: 'broll', ...extra }) as Beat;
const avatar = (extra: object = {}): Beat => ({ ...base, type: 'avatar', clip_url: 'https://c', ...extra }) as Beat;

describe('caption placement (owner 2026-10-20: caption below the photo frame, never in it or on the avatar)', () => {
  it('a full-bleed photo has no frame edge', () => {
    expect(photoFrameBottom({ photo_w: 4000, photo_h: 6000, focal: { x: 0.5, y: 0.4, w: 0.3, h: 0.3 } })).toBeNull();
    expect(photoFrameBottom({})).toBeNull();
  });
  it('a 16:9 letterbox frame ends at its centred bottom edge', () => {
    expect(photoFrameBottom({ photo_w: 1920, photo_h: 1080, focal: groupFocal })).toBe(1264);
  });
  it('a small photo card ends at its centred bottom edge (the live Oct 20 owner upload)', () => {
    // 480x270 shown at 2x = 960x540, centred: bottom = (1920 + 540) / 2
    expect(photoFrameBottom({ photo_w: 480, photo_h: 270 })).toBe(1230);
  });
  it('the caption starts below the lowest frame of the beat, and at the default top with no frame', () => {
    expect(captionPlacement(broll()).top).toBe(CAPTION_TOP);
    const wideFrame = { url: 'u', at_sec: 0, layout: 'single', photo_w: 1500, photo_h: 1000, focal: groupFocal };
    // 3:2 letterbox: 720 tall, bottom 1320
    expect(captionPlacement(broll({ visuals: [{ url: 'v', at_sec: 0, layout: 'single' }, wideFrame] })).top).toBe(1320 + CAPTION_GAP);
  });
  it('the caption top never sits inside a 16:9 frame', () => {
    expect(captionPlacement(broll({ photo_w: 1920, photo_h: 1080, focal: groupFocal })).top).toBeGreaterThanOrEqual(1264 + CAPTION_GAP);
  });
  it('a very tall card caps the caption top so it stays above the platforms\' bottom overlay', () => {
    expect(captionPlacement(broll({ photo_w: 400, photo_h: 580 })).top).toBe(CAPTION_TOP_MAX);
  });
  it('avatar beats keep the caption clear of the avatar corner box; photo beats use the full width', () => {
    expect(captionPlacement(avatar()).right).toBeGreaterThanOrEqual(AVATAR_BOX.width + 30);
    expect(captionPlacement(broll()).right).toBe(60);
  });
});
describe('caption font fit', () => {
  it('keeps 60px for ordinary words and shrinks only for a word too wide for the column', () => {
    const avatarColumn = 1080 - 60 - (320 + 40);
    expect(captionFontSize(['team', '—', 'still', 'building,'], avatarColumn)).toBe(60);
    const f = captionFontSize(['at', 'championship-winning', 'teams,'], avatarColumn);
    expect(f).toBeLessThan(60);
    expect(20 * 0.62 * f).toBeLessThanOrEqual(avatarColumn);
    expect(captionFontSize(['a'.repeat(60)], avatarColumn)).toBe(44);
  });
});
