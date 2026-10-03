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
    for (const d of [0, 0.49, 60.01, NaN, Infinity, 'x', null, undefined]) {
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

  it('missing/null/empty photo_url is an ERROR on every beat type (no fallback)', () => {
    for (const p of ['', null, undefined]) {
      for (const mk of [avatar, broll, (o: object) => stat({}, o)]) {
        const e = errs(props([mk({ photo_url: p, beat_index: 3 })]));
        expect(e.join()).toMatch(/photo_url missing/);
      }
    }
  });

  it('photo_url errors never echo the URL', () => {
    const secret = 'http://api.telegram.org/file/bot123456:SECRETTOKEN/x.jpg';
    const e = errs(props([broll({ photo_url: secret })])).join();
    expect(e).toMatch(/photo_url invalid/);
    expect(e).not.toMatch(/SECRETTOKEN|telegram/);
  });

  it('numeric strings for duration_sec and beat_index are coerced', () => {
    const r = okRes(props([broll({ duration_sec: '5.5', beat_index: '7' })]));
    const b = r.inputProps.beats[0];
    expect(b.duration_sec).toBe(5.5);
    expect(b.beat_index).toBe(7);
    expect(errs(props([broll({ duration_sec: 'abc' })])).join()).toMatch(/duration_sec/);
    expect(errs(props([broll({ duration_sec: '' })])).join()).toMatch(/duration_sec/);
    expect(errs(props([broll({ duration_sec: '100' })])).join()).toMatch(/duration_sec/);
    expect(errs(props([broll({ beat_index: 'x' })])).join()).toMatch(/beat_index/);
  });

  it('error labels include array position so duplicate beat_index stays unambiguous', () => {
    const e = errs(props([broll({ beat_index: 1 }), broll({ beat_index: 1, photo_url: null })]));
    expect(e.join()).toMatch(/position 1/);
    expect(e.join()).not.toMatch(/position 0/);
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

  it('stat prefix/suffix <= 5 chars (allows " PPG"); decimals integer 0..2', () => {
    expect(errs(props([stat({ prefix: '123456' })])).join()).toMatch(/prefix/);
    expect(errs(props([stat({ suffix: 'abcdef' })])).join()).toMatch(/suffix/);
    okRes(props([stat({ prefix: '$', suffix: ' PPG' })]));
    for (const d of [-1, 3, 1.5, '1']) {
      expect(errs(props([stat({ decimals: d })])).join()).toMatch(/decimals/);
    }
    for (const d of [0, 1, 2]) okRes(props([stat({ decimals: d })]));
  });

  it('formatted stat must be <= 11 characters (OdometerStat autofits; "$99,999.9MM" = 11 is browser-verified)', () => {
    expect(errs(props([stat({ value: 1234567890 })])).join()).toMatch(/formatted/); // "1,234,567,890" = 13
    expect(errs(props([stat({ value: 12345, prefix: 'abc', suffix: 'abcd' })])).join()).toMatch(/formatted/); // 13
    expect(errs(props([stat({ value: 123456, decimals: 2, prefix: '$', suffix: 'M' })])).join()).toMatch(/formatted/); // "$123,456.00M" = 12
    okRes(props([stat({ value: 27.4, decimals: 1, suffix: ' PPG' })])); // "27.4 PPG" = 8
    okRes(props([stat({ value: 1234.5, decimals: 1, prefix: '$', suffix: 'M' })])); // "$1,234.5M" = 9
    okRes(props([stat({ value: 99999.9, decimals: 1, prefix: '$', suffix: 'MM' })])); // "$99,999.9MM" = 11
    okRes(props([stat({ value: 12345, suffix: 'k' })])); // "12,345k" = 7
  });

  it('stat.value must be >= 0 and is rounded to the display precision', () => {
    expect(errs(props([stat({ value: -5 })])).join()).toMatch(/value/);
    expect(errs(props([stat({ value: -0.4 })])).join()).toMatch(/value/);
    const beatStat = (v: number, decimals: number) =>
      (okRes(props([stat({ value: v, decimals })])).inputProps.beats[0] as unknown as { stat: { value: number } }).stat.value;
    expect(beatStat(27.44, 1)).toBe(27.4);
    expect(beatStat(27.46, 1)).toBe(27.5);
    expect(beatStat(1250, 0)).toBe(1250);
    expect(beatStat(1.005, 2)).toBe(1);
    expect(beatStat(0, 0)).toBe(0);
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

describe('focal point', () => {
  const focalOf = (focal: unknown) => {
    const r = okRes(props([broll({ focal })]));
    return { beat: r.inputProps.beats[0] as Record<string, unknown>, warnings: r.warnings };
  };
  it('keeps a valid numeric focal', () => {
    const { beat, warnings } = focalOf({ x: 0.3, y: 0.6 });
    expect(beat.focal).toEqual({ x: 0.3, y: 0.6 });
    expect(warnings).toEqual([]);
  });
  it('coerces n8n-stringified focal numbers', () => {
    expect(focalOf({ x: '0.3', y: '0.6' }).beat.focal).toEqual({ x: 0.3, y: 0.6 });
  });
  it.each([[{ x: 1.4, y: 0.5 }], [{ x: 0.5 }], ['abc'], [{ x: '', y: '' }]])('drops invalid focal %j with a warning', (focal) => {
    const { beat, warnings } = focalOf(focal);
    expect(beat.focal).toBeUndefined();
    expect(warnings.some((w) => w.includes('focal ignored'))).toBe(true);
  });
  it('keeps a valid subject box (w, h) with the focal point', () => {
    expect(focalOf({ x: 0.4, y: 0.3, w: 0.2, h: '0.35' }).beat.focal).toEqual({ x: 0.4, y: 0.3, w: 0.2, h: 0.35 });
  });
  it('drops an invalid box but keeps the point, with a warning', () => {
    const { beat, warnings } = focalOf({ x: 0.4, y: 0.3, w: 0, h: 1.4 });
    expect(beat.focal).toEqual({ x: 0.4, y: 0.3 });
    expect(warnings.some((w) => w.includes('focal box ignored'))).toBe(true);
  });
  it('never trusts caller-supplied photo dimensions (rehost measures them)', () => {
    const r = okRes(props([broll({ photo_w: 10, photo_h: 9999 })]));
    const b = r.inputProps.beats[0] as Record<string, unknown>;
    expect(b.photo_w).toBeUndefined();
    expect(b.photo_h).toBeUndefined();
  });
  it('treats null or absent focal as no focal, no warning', () => {
    expect(focalOf(null).beat.focal).toBeUndefined();
    expect(focalOf(null).warnings).toEqual([]);
    const r = okRes(props([broll()]));
    expect((r.inputProps.beats[0] as Record<string, unknown>).focal).toBeUndefined();
  });
});
