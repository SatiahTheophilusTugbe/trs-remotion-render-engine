import { describe, it, expect, vi } from 'vitest';
import {
  allowedImageType, extForContentType, withinSizeCap, objectKey, publicUrl, hostOf,
  formatPhotoError, rehostPhotos, MAX_PHOTO_BYTES, BROWSER_USER_AGENT, REHOST_BUCKET,
} from './rehost';

const pub = async () => ['93.184.216.34'];
const img = (type = 'image/jpeg', size = 10, extra: Record<string, string> = {}) =>
  new Response(new Uint8Array(size), { status: 200, headers: { 'content-type': type, ...extra } });

describe('helpers', () => {
  it('content-type allow-list sweep', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'IMAGE/JPEG; charset=x']) {
      expect(allowedImageType(t)).not.toBeNull();
    }
    for (const t of ['text/html', 'image/svg+xml', 'application/octet-stream', '', null, undefined]) {
      expect(allowedImageType(t)).toBeNull();
    }
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
  it.each(failCases)('fails whole batch on %s, never leaks the URL', async (_n, make, expected) => {
    let call = 0;
    const fetchFn = (async () => (call++ === 1 ? make() : img())) as unknown as typeof fetch;
    const put = vi.fn().mockResolvedValue(undefined);
    const r = await rehostPhotos(beats, 'rid', { fetchFn, put, concurrency: 1, resolve: pub });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain(expected);
    expect(r.errors[0]).toContain('beat 11 (position 1)');
    expect(r.errors[0]).toContain('host=p1.example.invalid');
    expect(r.errors.join()).not.toMatch(/SECRET|token|https?:/);
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
