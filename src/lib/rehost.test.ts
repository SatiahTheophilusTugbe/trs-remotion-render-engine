import { describe, it, expect, vi } from 'vitest';
import {
  allowedImageType, sniffImageType, extForContentType, withinSizeCap, objectKey, publicUrl, hostOf,
  formatPhotoError, rehostPhotos, MAX_PHOTO_BYTES, BROWSER_USER_AGENT, REHOST_BUCKET, type RehostBeat,
} from './rehost';

const pub = async () => ['93.184.216.34'];
const img = (type = 'image/jpeg', size = 10, extra: Record<string, string> = {}) =>
  new Response(new Uint8Array(size), { status: 200, headers: { 'content-type': type, ...extra } });

// Real magic-byte signatures, padded with filler bytes so length checks are exercised too.
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0]);
const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const imgBytes = (type: string, bytes: Uint8Array, extra: Record<string, string> = {}) =>
  new Response(bytes, { status: 200, headers: { 'content-type': type, ...extra } });

describe('helpers', () => {
  it('content-type allow-list sweep', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'IMAGE/JPEG; charset=x']) {
      expect(allowedImageType(t)).not.toBeNull();
    }
    for (const t of ['text/html', 'image/svg+xml', 'application/octet-stream', '', null, undefined]) {
      expect(allowedImageType(t)).toBeNull();
    }
  });
  it('sniffs a real image type from its byte signature regardless of length padding', () => {
    expect(sniffImageType(JPEG_BYTES)).toBe('image/jpeg');
    expect(sniffImageType(PNG_BYTES)).toBe('image/png');
    expect(sniffImageType(GIF_BYTES)).toBe('image/gif');
    expect(sniffImageType(WEBP_BYTES)).toBe('image/webp');
  });
  it('sniff rejects non-image bytes and bytes too short to carry any signature', () => {
    expect(sniffImageType(new TextEncoder().encode('<html></html>'))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull(); // truncated JPEG signature
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e]))).toBeNull(); // truncated PNG signature
  });
  it('ext from content-type', () => {
    expect(extForContentType('image/jpeg')).toBe('jpg');
    expect(extForContentType('image/png')).toBe('png');
    expect(extForContentType('image/webp')).toBe('webp');
    expect(extForContentType('image/gif')).toBe('gif');
    expect(extForContentType('text/html')).toBeNull();
  });
  it('size cap boundaries', () => {
    expect(withinSizeCap(0)).toBe(false);
    expect(withinSizeCap(1)).toBe(true);
    expect(withinSizeCap(MAX_PHOTO_BYTES)).toBe(true);
    expect(withinSizeCap(MAX_PHOTO_BYTES + 1)).toBe(false);
  });
  it('key naming and public url', () => {
    expect(objectKey('u-1', 3, 'png')).toBe('assets/u-1/3.png');
    expect(publicUrl('assets/u-1/3.png')).toBe(`https://s3.us-east-1.amazonaws.com/${REHOST_BUCKET}/assets/u-1/3.png`);
  });
  it('hostname-only formatting', () => {
    expect(hostOf('https://tok:pw@cdn.example.invalid/bot123:SECRET/p.jpg?x=1#f')).toBe('cdn.example.invalid');
    expect(hostOf('not a url')).toBe('unknown');
    expect(formatPhotoError(2, 1, 'h.invalid', 404)).toBe(
      'beat 2 (position 1): photo could not be fetched (host=h.invalid, status=404)',
    );
    expect(BROWSER_USER_AGENT).toMatch(/^Mozilla\/5\.0/);
  });
});

describe('rehostPhotos', () => {
  const beats = [0, 1, 2].map((i) => ({
    beat_index: i + 10,
    photo_url: `https://p${i}.example.invalid/a.jpg?token=SECRET${i}`,
  }));

  it('replaces photo_url with S3 URLs, sends UA, uploads with content type', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi.fn(async () => img('image/png')) as unknown as typeof fetch;
    const r = await rehostPhotos(beats, 'rid', { fetchFn, put, resolve: pub });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.beats.map((b) => b.photo_url)).toEqual([0, 1, 2].map((i) => publicUrl(`assets/rid/${i}.png`)));
    expect(r.beats.map((b) => b.beat_index)).toEqual([10, 11, 12]);
    expect(beats[0].photo_url).toMatch(/example\.invalid/); // input not mutated
    expect(put).toHaveBeenCalledTimes(3);
    expect(put.mock.calls[0][0].contentType).toBe('image/png');
    const init = vi.mocked(fetchFn).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(BROWSER_USER_AGENT);
  });

  it('records the photo pixel size when the header is readable, and omits it when not', async () => {
    const png = new Uint8Array(33);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(png.buffer).setUint32(16, 1200);
    new DataView(png.buffer).setUint32(20, 800);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(imgBytes('image/png', png))
      .mockResolvedValueOnce(img('image/jpeg')) as unknown as typeof fetch;
    const r = await rehostPhotos(beats.slice(0, 2), 'rid', { fetchFn, put: vi.fn().mockResolvedValue(undefined), resolve: pub, concurrency: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [b0, b1] = r.beats as RehostBeat[];
    expect([b0.photo_w, b0.photo_h]).toEqual([1200, 800]);
    expect(b1.photo_w).toBeUndefined();
  });

  it('carries a beat focal point through rehosting unchanged', async () => {
    const fetchFn = vi.fn(async () => img('image/png')) as unknown as typeof fetch;
    const withFocal = [{ ...beats[0], focal: { x: 0.3, y: 0.6 } }];
    const r = await rehostPhotos(withFocal, 'rid', { fetchFn, put: vi.fn().mockResolvedValue(undefined), resolve: pub });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.beats[0].focal).toEqual({ x: 0.3, y: 0.6 });
  });

  it('still succeeds when the server declares a generic/missing content-type but the bytes are a real image (Telegram quirk)', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(imgBytes('application/octet-stream', JPEG_BYTES))
      .mockResolvedValueOnce(imgBytes('', PNG_BYTES))
      .mockResolvedValueOnce(imgBytes('application/octet-stream', GIF_BYTES)) as unknown as typeof fetch;
    const r = await rehostPhotos(beats, 'rid', { fetchFn, put, resolve: pub });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.beats.map((b) => b.photo_url)).toEqual([
      publicUrl('assets/rid/0.jpg'),
      publicUrl('assets/rid/1.png'),
      publicUrl('assets/rid/2.gif'),
    ]);
    expect(put.mock.calls.map((c) => c[0].contentType)).toEqual(['image/jpeg', 'image/png', 'image/gif']);
  });

  it('still rejects when neither the declared content-type nor the real bytes are a recognised image', async () => {
    const fetchFn = vi.fn(async () => imgBytes('application/octet-stream', new TextEncoder().encode('not an image'))) as unknown as typeof fetch;
    const r = await rehostPhotos(beats, 'rid', { fetchFn, put: async () => {}, resolve: pub });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatch(/status=unsupported_content_type/);
  });

  it('limits concurrency to 4', async () => {
    let active = 0;
    let peak = 0;
    const fetchFn = (async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return img();
    }) as unknown as typeof fetch;
    const many = Array.from({ length: 12 }, (_, i) => ({ beat_index: i, photo_url: 'https://h.example.invalid/x.jpg' }));
    const r = await rehostPhotos(many, 'rid', { fetchFn, put: async () => {}, resolve: pub });
    expect(r.ok).toBe(true);
    expect(peak).toBe(4);
  });

  const failCases: [string, () => Response, string][] = [
    ['http status', () => new Response('no', { status: 403 }), 'status=403'],
    ['bad content type', () => img('text/html'), 'status=unsupported_content_type'],
    [
      'declared too large',
      () => img('image/jpeg', 10, { 'content-length': String(MAX_PHOTO_BYTES + 1) }),
      'status=too_large',
    ],
    ['empty body', () => img('image/jpeg', 0), 'status=empty_body'],
    [
      'network error',
      () => {
        throw new TypeError('fetch failed: https://p1.example.invalid/a.jpg?token=SECRET1');
      },
      'status=network_error',
    ],
    [
      'timeout',
      () => {
        throw new DOMException('t', 'TimeoutError');
      },
      'status=timeout',
    ],
  ];
  it.each(failCases)('an unreachable photo (%s) borrows the nearest beat photo, warns, never leaks the URL', async (_n, make, expected) => {
    let call = 0;
    const fetchFn = (async () => (call++ === 1 ? make() : img())) as unknown as typeof fetch;
    const put = vi.fn().mockResolvedValue(undefined);
    const r = await rehostPhotos(beats, 'rid', { fetchFn, put, concurrency: 1, resolve: pub });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain(expected);
    expect(r.warnings[0]).toContain('beat 11 (position 1)');
    expect(r.warnings[0]).toContain('host=p1.example.invalid');
    expect(r.warnings.join()).not.toMatch(/SECRET|token|https?:/);
    // never the original URL: the failed beat shows the previous beat's re-hosted photo
    expect(r.beats[1].photo_url).toBe(r.beats[0].photo_url);
    expect(r.beats.map((b) => b.photo_url).join()).not.toMatch(/example\.invalid/);
  });

  it('a borrowed photo brings its own credit and subject box, never those of the failed photo', async () => {
    const withMeta = [
      { beat_index: 0, photo_url: 'https://a.example.invalid/1.jpg', photo_credit: 'A', focal: { x: 0.2, y: 0.2 } },
      { beat_index: 1, photo_url: 'https://dead.example.invalid/2.jpg', photo_credit: 'Dead', focal: { x: 0.9, y: 0.9 } },
    ];
    const fetchFn = (async (u: string) => (String(u).includes('dead') ? new Response('', { status: 404 }) : img())) as unknown as typeof fetch;
    const r = await rehostPhotos(withMeta, 'rid', { fetchFn, put: async () => {}, resolve: pub });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.beats[1].photo_credit).toBe('A');
    expect(r.beats[1].focal).toEqual({ x: 0.2, y: 0.2 });
  });

  it('fails only when no photo at all could be fetched', async () => {
    const fetchFn = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    const r = await rehostPhotos(beats, 'rid', { fetchFn, put: async () => {}, resolve: pub });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(3);
  });

  it('upload failure fails the batch', async () => {
    const put = vi.fn().mockRejectedValue(new Error('AccessDenied https://s3/x?sig=SECRET'));
    const r = await rehostPhotos(beats, 'rid', { fetchFn: (async () => img()) as unknown as typeof fetch, put, resolve: pub });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(3);
    expect(r.errors.join()).toContain('status=upload_failed');
    expect(r.errors.join()).not.toMatch(/SECRET|AccessDenied/);
  });
});

describe('rehostPhotos visuals', () => {
  type VB = RehostBeat & { visuals?: Record<string, unknown>[] };
  const beat = (): VB => ({
    beat_index: 3,
    photo_url: 'https://p.example.invalid/hero.jpg',
    visuals: [
      { url: 'https://p.example.invalid/hero.jpg', at_sec: 0, layout: 'single' },
      { url: 'https://q.example.invalid/b.jpg', at_sec: 4, layout: 'split', url_b: 'https://r.example.invalid/c.jpg' },
    ],
  });

  it('rehosts visual urls and sets dims', async () => {
    const png = new Uint8Array(33);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(png.buffer).setUint32(16, 1200);
    new DataView(png.buffer).setUint32(20, 800);
    const fetchFn = vi.fn(async () => imgBytes('image/png', png)) as unknown as typeof fetch;
    const r = await rehostPhotos([beat()], 'rid', { fetchFn, put: async () => {}, resolve: pub });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = r.beats[0].visuals!;
    expect(v[0].url).toBe(r.beats[0].photo_url);
    expect(String(v[1].url)).toMatch(/^https:\/\/s3\./);
    expect(String(v[1].url_b)).toMatch(/^https:\/\/s3\./);
    expect(v[1].photo_w).toBe(1200);
    expect(v[1].photo_h_b).toBe(800);
  });

  it('object keys are unique per visual', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi.fn(async () => img('image/jpeg')) as unknown as typeof fetch;
    await rehostPhotos([beat()], 'rid', { fetchFn, put, resolve: pub });
    const keys = put.mock.calls.map((c) => c[0].key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('assets/rid/0-1.jpg');
    expect(keys).toContain('assets/rid/0-1b.jpg');
  });

  it('an unreachable half of a split card leaves a single image of the other half', async () => {
    const fetchFn = vi.fn(async (u: string) =>
      String(u).includes('q.example') ? new Response('', { status: 404 }) : img(),
    ) as unknown as typeof fetch;
    const b = beat();
    b.visuals![1].focal_b = { x: 0.3, y: 0.3 };
    b.visuals![1].credit_b = 'R';
    const r = await rehostPhotos([b], 'rid', { fetchFn, put: async () => {}, resolve: pub });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.join(' ')).toContain('visuals[1].url');
    expect(r.warnings.join(' ')).not.toContain('example.invalid/b.jpg');
    const v = r.beats[0].visuals!;
    expect(v).toHaveLength(2);
    expect(v[1].layout).toBe('single');
    expect(String(v[1].url)).toMatch(/^https:\/\/s3\./);
    expect(v[1].url_b).toBeUndefined();
    expect(v[1].focal).toEqual({ x: 0.3, y: 0.3 });
    expect(v[1].credit).toBe('R');
  });

  it('an unreachable single visual is dropped; the next one starts the beat', async () => {
    const fetchFn = vi.fn(async (u: string) =>
      String(u).includes('hero') ? new Response('', { status: 404 }) : img(),
    ) as unknown as typeof fetch;
    const r = await rehostPhotos([beat()], 'rid', { fetchFn, put: async () => {}, resolve: pub });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = r.beats[0].visuals!;
    expect(v).toHaveLength(1);
    expect(v[0].at_sec).toBe(0);
    // the beat photo (same url as the dropped visual) becomes the first surviving visual's image
    expect(r.beats[0].photo_url).toBe(v[0].url);
  });

  it('identical urls are fetched once', async () => {
    const fetchFn = vi.fn(async () => img()) as unknown as typeof fetch;
    await rehostPhotos([beat()], 'rid', { fetchFn, put: async () => {}, resolve: pub });
    expect(vi.mocked(fetchFn).mock.calls.length).toBe(3);
  });
});
