import { describe, it, expect } from 'vitest';
import { checkImage, linkFailureReason, normaliseLink, MIN_SIDE, MAX_LINK_BYTES } from './rehostUrl';
import { RehostFailure } from './rehost';

const png = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};

describe('checkImage', () => {
  it('accepts a real image with one side >= 600', () => {
    expect(checkImage(png(1200, 500))).toEqual({ ok: true, mime: 'image/png', width: 1200, height: 500 });
  });
  it('rejects small images and non-images', () => {
    expect(checkImage(png(400, 300))).toEqual({ ok: false, reason: 'too small' });
    expect(checkImage(new TextEncoder().encode('<html>'))).toEqual({ ok: false, reason: 'not an image' });
  });
  it('rejects images over the 10 MB link cap', () => {
    const big = new Uint8Array(MAX_LINK_BYTES + 1);
    big.set(png(1200, 800));
    expect(checkImage(big)).toEqual({ ok: false, reason: 'too large' });
  });
  it('uses the 600px rule', () => expect(MIN_SIDE).toBe(600));
});

describe('normaliseLink', () => {
  it('upgrades http to https and trims', () => {
    expect(normaliseLink('  http://a.com/x.jpg ')).toBe('https://a.com/x.jpg');
    expect(normaliseLink('https://a.com/x.jpg')).toBe('https://a.com/x.jpg');
  });
  it('refuses non-web links', () => {
    expect(normaliseLink('ftp://a.com/x.jpg')).toBeNull();
    expect(normaliseLink('not a link')).toBeNull();
    expect(normaliseLink(42)).toBeNull();
  });
});

describe('linkFailureReason', () => {
  it('maps internal failures to owner-facing reasons, never the URL', () => {
    expect(linkFailureReason(new RehostFailure('blocked'))).toBe('bad link');
    expect(linkFailureReason(new RehostFailure('too_large'))).toBe('too large');
    expect(linkFailureReason(new RehostFailure(403))).toBe('site blocked the download');
    expect(linkFailureReason(new RehostFailure('too_many_redirects'))).toBe('site blocked the download');
    const t = new Error('x'); t.name = 'TimeoutError';
    expect(linkFailureReason(t)).toBe('timed out');
    expect(linkFailureReason(new Error('boom'))).toBe('site blocked the download');
  });
});
