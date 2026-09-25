import { describe, it, expect } from 'vitest';
import { validateRenderInput } from './validate';

const photo = 'https://example.com/p.jpg';
const avatar = (o: object = {}) => ({
  type: 'avatar', clip_url: 'https://example.com/a.mp4', photo_url: photo,
  narration_line: 'hi', duration_sec: 5, beat_index: 0, ...o,
});
const broll = (o: object = {}) => ({
  type: 'broll', photo_url: photo, narration_line: 'hi', duration_sec: 5, beat_index: 1, ...o,
});
const stat = (s: object = {}, o: object = {}) => ({
  type: 'stat', photo_url: photo, narration_line: 'hi', duration_sec: 5, beat_index: 2,
  stat: { value: 42, label: 'Goals', ...s }, ...o,
});
const props = (beats: unknown[], extra: object = {}) => ({ fps: 30, beats, ...extra });

const errs = (input: unknown): string[] => {
  const r = validateRenderInput(input);
  if (r.ok) throw new Error('expected failure');
  return r.errors;
};
const okRes = (input: unknown) => {
  const r = validateRenderInput(input);
  if (!r.ok) throw new Error('expected ok: ' + r.errors.join('; '));
  return r;
};

describe('validateRenderInput', () => {
  it('accepts a happy-path avatar+broll+stat payload', () => {
    const r = okRes(props([avatar(), broll(), stat()], { leagueBadge: 'EPL', musicUrl: 'https://m.com/x.mp3', transitions: true }));
    expect(r.warnings).toEqual([]);
    expect(r.inputProps.beats).toHaveLength(3);
    expect(r.inputProps.fps).toBe(30);
    expect(r.inputProps.leagueBadge).toBe('EPL');
    expect(r.inputProps.transitions).toBe(true);
  });

  it('rejects non-object inputProps', () => {
    for (const bad of [null, undefined, 'x', 5, []]) expect(errs(bad).length).toBeGreaterThan(0);
  });

  it('requires beats to be a non-empty array of at most 40', () => {
    expect(errs({ fps: 30 })[0]).toMatch(/beats/);
    expect(errs(props([]))[0]).toMatch(/beats/);
    const many = Array.from({ length: 41 }, (_, i) => broll({ duration_sec: 1, beat_index: i }));
    expect(errs(props(many))[0]).toMatch(/40/);
    okRes(props(many.slice(0, 40)));
  });

  it('fps must be 30 when present; absent defaults to 30', () => {
    expect(errs(props([broll()], { fps: 25 })).join()).toMatch(/fps/);
    expect(okRes({ beats: [broll()] }).inputProps.fps).toBe(30);
  });

  it('rejects unknown beat types', () => {
    expect(errs(props([broll({ type: 'video' })])).join()).toMatch(/type/);
  });

  it('duration_sec must be finite within 0.5..60 (sweep)', () => {
    for (const d of [0, 0.49, 60.01, NaN, Infinity, '5', null, undefined]) {
      expect(errs(props([broll({ duration_sec: d })])).join()).toMatch(/duration_sec/);
    }
    for (const d of [0.5, 1, 30, 60]) okRes(props([broll({ duration_sec: d })]));
  });

  it('total duration must be <= 180s', () => {
    const three = [60, 60, 60].map((d, i) => broll({ duration_sec: d, beat_index: i }));
    okRes(props(three));
    const over = [...three, broll({ duration_sec: 0.5, beat_index: 3 })];
    expect(errs(props(over)).join()).toMatch(/180/);
  });

  it('beat_index must be a number', () => {
    expect(errs(props([broll({ beat_index: '1' })])).join()).toMatch(/beat_index/);
    expect(errs(props([broll({ beat_index: undefined })])).join()).toMatch(/beat_index/);
  });

  it('avatar requires https clip_url; broll clip_url stays optional', () => {
    for (const c of [undefined, null, '', 'http://x.com/a.mp4', 'ftp://x', 5]) {
      expect(errs(props([avatar({ clip_url: c })])).join()).toMatch(/clip_url/);
    }
    okRes(props([broll({ clip_url: null })]));
    okRes(props([broll()]));
    okRes(props([broll({ clip_url: 'https://x.com/b.mp4' })]));
  });

  it('empty/null/undefined photo -> null + warning; still ok', () => {
    for (const p of ['', null, undefined]) {
      const r = okRes(props([broll({ photo_url: p, beat_index: 3 })]));
      expect(r.inputProps.beats[0].photo_url).toBeNull();
      expect(r.warnings).toContain('beat 3: no photo (TRS fallback background will render)');
    }
  });

  it('non-empty invalid photo_url is an ERROR (never dropped)', () => {
    for (const p of ['http://x.com/p.jpg', 'not a url', 42, 'https://x.com/' + 'a'.repeat(2000)]) {
      expect(errs(props([broll({ photo_url: p })])).join()).toMatch(/photo_url/);
    }
    okRes(props([broll({ photo_url: 'https://x.com/' + 'a'.repeat(1900) })]));
  });

  it('overlay_text is trimmed and clamped to 80 with ellipsis + warning', () => {
    const r = okRes(props([broll({ overlay_text: '  hello  ' })]));
    expect(r.inputProps.beats[0].overlay_text).toBe('hello');
    expect(r.warnings).toEqual([]);
    const exact = okRes(props([broll({ overlay_text: 'a'.repeat(80) })]));
    expect(exact.inputProps.beats[0].overlay_text).toHaveLength(80);
    expect(exact.warnings).toEqual([]);
    const long = okRes(props([broll({ overlay_text: 'a'.repeat(120) })]));
    const t = long.inputProps.beats[0].overlay_text!;
    expect(t).toHaveLength(80);
    expect(t.endsWith('…')).toBe(true);
    expect(long.warnings.join()).toMatch(/overlay_text/);
  });

  it('stat beat requires a stat object with finite value', () => {
    expect(errs(props([stat(undefined, { stat: undefined })])).join()).toMatch(/stat/);
    for (const v of [NaN, Infinity, '5', null]) {
      expect(errs(props([stat({ value: v })])).join()).toMatch(/value/);
    }
  });

  it('stat label required, clamped to 40 with warning', () => {
    expect(errs(props([stat({ label: '' })])).join()).toMatch(/label/);
    expect(errs(props([stat({ label: '   ' })])).join()).toMatch(/label/);
    const r = okRes(props([stat({ label: 'L'.repeat(60) })]));
    const b = r.inputProps.beats[0];
    expect(b.type === 'stat' && b.stat.label).toHaveLength(40);
    expect(r.warnings.join()).toMatch(/label/);
  });

  it('stat prefix/suffix <= 3 chars; decimals integer 0..2', () => {
    expect(errs(props([stat({ prefix: '1234' })])).join()).toMatch(/prefix/);
    expect(errs(props([stat({ suffix: 'abcd' })])).join()).toMatch(/suffix/);
    okRes(props([stat({ prefix: '$', suffix: 'ab' })]));
    for (const d of [-1, 3, 1.5, '1']) {
      expect(errs(props([stat({ decimals: d })])).join()).toMatch(/decimals/);
    }
    for (const d of [0, 1, 2]) okRes(props([stat({ decimals: d })]));
  });

  it('formatted stat must be <= 7 characters (sweep)', () => {
    expect(errs(props([stat({ value: 1234567 })])).join()).toMatch(/formatted/); // "1,234,567"
    expect(errs(props([stat({ value: 12345, suffix: 'abc' })])).join()).toMatch(/formatted/); // 9
    expect(errs(props([stat({ value: 1.5, decimals: 2, prefix: 'abc', suffix: 'x' })])).join()).toMatch(/formatted/); // 8
    okRes(props([stat({ value: 99999 })])); // "99,999" = 6
    okRes(props([stat({ value: 12.5, decimals: 1, suffix: '%' })]));
    okRes(props([stat({ value: 1234, suffix: '%' })])); // "1,234%" = 6
    okRes(props([stat({ value: 12345, suffix: 'k' })])); // "12,345k" = 7
  });

  it('word_timings passes through untouched', () => {
    const wt = '[{"word":"a","start":0,"end":1}]';
    expect(okRes(props([broll({ word_timings: wt })])).inputProps.beats[0].word_timings).toBe(wt);
    expect(okRes(props([broll({ word_timings: null })])).inputProps.beats[0].word_timings).toBeNull();
  });

  it('musicUrl must be https when present', () => {
    expect(errs(props([broll()], { musicUrl: 'http://m.com/x.mp3' })).join()).toMatch(/musicUrl/);
    okRes(props([broll()], { musicUrl: null }));
    okRes(props([broll()], { musicUrl: 'https://m.com/x.mp3' }));
  });
});
