import { describe, it, expect, vi } from 'vitest';
import { assertSafeUrl, isBlockedIp, rehostPhotos, MAX_PHOTO_BYTES } from './rehost';

const pub = async () => ['93.184.216.34'];
const img = (size = 10) =>
  new Response(new Uint8Array(size), { status: 200, headers: { 'content-type': 'image/jpeg' } });
const one = [{ beat_index: 5, photo_url: 'https://cdn.example.invalid/a.jpg?token=SECRET' }];
const run = (fetchFn: unknown, extra: Record<string, unknown> = {}) =>
  rehostPhotos(one, 'rid', { fetchFn: fetchFn as typeof fetch, put: async () => {}, resolve: pub, ...extra });
const redirect = (loc: string, status = 302) => new Response(null, { status, headers: { location: loc } });

describe('assertSafeUrl / blocked targets', () => {
  const blocked = [
    'http://cdn.example.invalid/a.jpg', 'https://localhost/a', 'https://LOCALHOST./a', 'https://a.localhost/a',
    'https://db.internal/a', 'https://printer.local/a',
    'https://127.0.0.1/a', 'https://127.255.255.254/a', 'https://10.0.0.1/a', 'https://172.16.0.1/a',
    'https://172.31.255.255/a', 'https://192.168.1.1/a', 'https://169.254.169.254/latest/meta-data',
    'https://169.254.0.1/a', 'https://0.0.0.0/a', 'https://0.1.2.3/a', 'https://100.64.0.1/a',
    'https://100.127.255.255/a', 'https://[::1]/a', 'https://[::]/a', 'https://[fc00::1]/a',
    'https://[fd12:3456::1]/a', 'https://[fe80::1]/a', 'https://[febf::1]/a',
    'https://[::ffff:127.0.0.1]/a', 'https://[::ffff:169.254.169.254]/a', 'https://[::ffff:10.0.0.1]/a',
    'https://[64:ff9b::a00:1]/a', 'ftp://example.invalid/a', 'not a url',
  ];
  const allowed = [
    'https://cdn.nba.com/a.jpg', 'https://8.8.8.8/a', 'https://172.15.0.1/a', 'https://172.32.0.1/a',
    'https://100.63.0.1/a', 'https://100.128.0.1/a', 'https://169.253.0.1/a', 'https://192.169.0.1/a',
    'https://[2606:4700::1111]/a', 'https://[::ffff:8.8.8.8]/a', 'https://notlocalhost.example.invalid/a',
    'https://localhost.example.invalid/a',
  ];
  it.each(blocked)('blocks %s', (u) => expect(() => assertSafeUrl(u)).toThrow());
  it.each(allowed)('allows %s', (u) => expect(() => assertSafeUrl(u)).not.toThrow());
  it('isBlockedIp fails closed on garbage', () => expect(isBlockedIp('zzz')).toBe(true));
});

describe('guarded fetching', () => {
  it('rejects a blocked start URL without fetching, reason blocked, no URL leak', async () => {
    const f = vi.fn();
    const r = await rehostPhotos([{ beat_index: 1, photo_url: 'https://169.254.169.254/x?token=SECRET' }], 'rid', {
      fetchFn: f as unknown as typeof fetch,
      put: async () => {},
      resolve: pub,
    });
    expect(f).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toContain('host=169.254.169.254, status=blocked');
    expect(r.errors.join()).not.toMatch(/SECRET|https?:/);
  });

  it('uses redirect: manual', async () => {
    const f = vi.fn(async () => img());
    await run(f);
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].redirect).toBe('manual');
  });

  it('follows a relative redirect and an absolute https redirect', async () => {
    const urls: string[] = [];
    const f = async (u: string) => {
      urls.push(u);
      if (urls.length === 1) return redirect('/moved/b.jpg');
      if (urls.length === 2) return redirect('https://img.example.invalid/c.jpg');
      return img();
    };
    const r = await run(f);
    expect(r.ok).toBe(true);
    expect(urls[1]).toBe('https://cdn.example.invalid/moved/b.jpg');
    expect(urls[2]).toBe('https://img.example.invalid/c.jpg');
  });

  it.each(['http://cdn.example.invalid/x', 'https://10.0.0.5/x', 'https://[::1]/x', 'https://svc.internal/x'])(
    'rejects redirect to %s',
    async (loc) => {
      let n = 0;
      const f = vi.fn(async () => (n++ === 0 ? redirect(loc) : img()));
      const r = await run(f);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.errors[0]).toContain('status=blocked');
      expect(f).toHaveBeenCalledTimes(1);
      expect(r.errors.join()).not.toMatch(/SECRET|10\.0\.0\.5|https?:/);
    },
  );

  it('allows exactly 3 redirects, rejects the 4th', async () => {
    const chain = (hops: number) => {
      let n = 0;
      return async () => (n++ < hops ? redirect(`https://h${n}.example.invalid/x`) : img());
    };
    expect((await run(chain(3))).ok).toBe(true);
    const r = await run(chain(4));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('status=too_many_redirects');
  });

  it('redirect without Location fails with the status', async () => {
    const r = await run(async () => new Response(null, { status: 302 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('status=302');
  });

  it('rejects a hostname that resolves to a private address (any of several)', async () => {
    const f = vi.fn(async () => img());
    for (const addrs of [['10.1.2.3'], ['93.184.216.34', '169.254.169.254'], ['::1'], ['::ffff:192.168.0.1'], []]) {
      const r = await run(f, { resolve: async () => addrs });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]).toContain('status=blocked');
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('re-resolves on every hop (redirect to a host that resolves privately is blocked)', async () => {
    let n = 0;
    const f = vi.fn(async () => (n++ === 0 ? redirect('https://rebind.example.invalid/x') : img()));
    const resolve = async (h: string) => (h === 'rebind.example.invalid' ? ['127.0.0.1'] : ['93.184.216.34']);
    const r = await run(f, { resolve });
    expect(r.ok).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('DNS failure is a generic network_error', async () => {
    const r = await run(async () => img(), {
      resolve: async () => {
        throw new Error('ENOTFOUND cdn.example.invalid');
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('status=network_error');
  });
});

describe('streamed size cap', () => {
  const chunked = (chunks: number, size: number, headers: Record<string, string> = {}) => {
    let sent = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>(
      {
        pull(c) {
          if (sent++ >= chunks) c.close();
          else c.enqueue(new Uint8Array(size));
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    const res = new Response(body, { headers: { 'content-type': 'image/jpeg', ...headers } });
    return { res, cancel, pulled: () => sent };
  };
  it('cancels a chunked oversized body with no content-length, without reading it all', async () => {
    const { res, cancel, pulled } = chunked(100, 1024 * 1024);
    const r = await run(async () => res);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('status=too_large');
    expect(cancel).toHaveBeenCalled();
    expect(pulled()).toBeLessThan(40); // cap is ~15 chunks; stopped long before all 100
  });
  it('a lying (small) content-length cannot bypass the cap', async () => {
    const { res } = chunked(20, 1024 * 1024, { 'content-length': '100' });
    const r = await run(async () => res);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('status=too_large');
  });
  it('declared oversized content-length is rejected early and cancelled', async () => {
    const { res, cancel } = chunked(1, 10, { 'content-length': String(MAX_PHOTO_BYTES + 1) });
    const r = await run(async () => res);
    expect(r.ok).toBe(false);
    expect(cancel).toHaveBeenCalled();
  });
  it('accepts a body of exactly the cap', async () => {
    const { res } = chunked(15, 1024 * 1024);
    expect((await run(async () => res)).ok).toBe(true);
  });
});

describe('global deadline', () => {
  it('remaining photos fail fast with timeout once the budget is spent', async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ beat_index: i, photo_url: 'https://h.example.invalid/x.jpg' }));
    const f = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return img();
    });
    const r = await rehostPhotos(many, 'rid', {
      fetchFn: f as unknown as typeof fetch,
      put: async () => {},
      resolve: pub,
      concurrency: 1,
      budgetMs: 50,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
    expect(r.errors.every((e) => e.includes('status=timeout'))).toBe(true);
    expect(f.mock.calls.length).toBeLessThan(6);
  });
});
