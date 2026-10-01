import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function () {
    return { send: (cmd: unknown) => mockS3Send(cmd) };
  }),
  PutObjectCommand: vi.fn(function (input: unknown) {
    return { input };
  }),
}));

import { POST } from '../../api/rehost-telegram-file';

const mockS3Send = vi.fn();
const mockFetch = vi.fn();
const KEY = 'test-key';
// Realistic shape (digits:token) so redactMessage's bot-token pattern actually matches it in tests.
const TOKEN = '123456789:AAFakeTestTokenSentinelXYZ';

const telegramOk = (filePath = 'photos/file_1.jpg') =>
  new Response(JSON.stringify({ ok: true, result: { file_path: filePath } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const telegramFail = (description: string) =>
  new Response(JSON.stringify({ ok: false, description }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const img = (size = 10) =>
  new Response(new Uint8Array(size), { status: 200, headers: { 'content-type': 'image/jpeg' } });

const req = (body: unknown, key: string | null = KEY, raw = false) =>
  new Request('https://x.test/api/rehost-telegram-file', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-trs-render-key': key } : {}) },
    body: raw ? (body as string) : JSON.stringify(body),
  });

// A chunked stream that can lie about content-length and/or run far longer than the cap allows,
// so we can prove the cap aborts mid-stream instead of buffering everything first.
const chunkedImage = (chunks: number, size: number, headers: Record<string, string> = {}) => {
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
  return { res: new Response(body, { headers: { 'content-type': 'image/jpeg', ...headers } }), cancel, pulled: () => sent };
};

beforeEach(() => {
  process.env.TRS_RENDER_API_KEY = KEY;
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.REMOTION_AWS_ACCESS_KEY_ID = 'AKIAEXAMPLE';
  process.env.REMOTION_AWS_SECRET_ACCESS_KEY = 'secret';
  mockS3Send.mockReset();
  mockS3Send.mockResolvedValue({});
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (url: string) => (url.includes('/getFile') ? telegramOk() : img()));
  vi.stubGlobal('fetch', mockFetch);
});

describe('POST /api/rehost-telegram-file', () => {
  it('401 without or with wrong key; 401 wins even when misconfigured', async () => {
    expect((await POST(req({ file_id: 'f1' }, null))).status).toBe(401);
    expect((await POST(req({ file_id: 'f1' }, 'nope'))).status).toBe(401);
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect((await POST(req({ file_id: 'f1' }, 'nope'))).status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('400 invalid input for missing/empty/non-string file_id and malformed bodies', async () => {
    for (const [b, raw] of [
      [{}, false],
      [{ file_id: '' }, false],
      [{ file_id: 123 }, false],
      [{ file_id: null }, false],
      ['not json{', true],
      ['[1]', true],
    ] as const) {
      const res = await POST(req(b, KEY, raw));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('invalid input');
      expect(Array.isArray(json.details)).toBe(true);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('500 server misconfigured when a required env var is missing; nothing fetched', async () => {
    for (const name of ['TELEGRAM_BOT_TOKEN', 'REMOTION_AWS_ACCESS_KEY_ID', 'REMOTION_AWS_SECRET_ACCESS_KEY']) {
      const saved = process.env[name];
      delete process.env[name];
      const res = await POST(req({ file_id: 'f1' }));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'server misconfigured' });
      process.env[name] = saved;
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('502 telegram_error when getFile returns ok:false; token never leaks into the response', async () => {
    mockFetch.mockImplementation(async (url: string) =>
      url.includes('/getFile')
        ? telegramFail(`Bad Request: failed for https://api.telegram.org/bot${TOKEN}/getFile?file_id=x`)
        : img(),
    );
    const res = await POST(req({ file_id: 'f1' }));
    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(TOKEN);
    expect(text).toContain('telegram_error');
  });

  it('502 when getFile succeeds but the file download 404s; no token leak', async () => {
    mockFetch.mockImplementation(async (url: string) =>
      url.includes('/getFile') ? telegramOk() : new Response('not found', { status: 404 }),
    );
    const res = await POST(req({ file_id: 'f1' }));
    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(TOKEN);
    expect(text).toMatch(/telegram_error/);
  });

  it('422 when the declared content-length already exceeds the cap; body cancelled unread', async () => {
    const { res, cancel } = chunkedImage(1, 10, { 'content-length': String(15 * 1024 * 1024 + 1) });
    mockFetch.mockImplementation(async (url: string) => (url.includes('/getFile') ? telegramOk() : res));
    const out = await POST(req({ file_id: 'f1' }));
    expect(out.status).toBe(422);
    expect(cancel).toHaveBeenCalled();
    const text = JSON.stringify(await out.json());
    expect(text).not.toContain(TOKEN);
  });

  it('422 when a lying (small) content-length cannot bypass the streaming cap; truncated not exhausted', async () => {
    const { res, cancel, pulled } = chunkedImage(100, 1024 * 1024, { 'content-length': '100' });
    mockFetch.mockImplementation(async (url: string) => (url.includes('/getFile') ? telegramOk() : res));
    const out = await POST(req({ file_id: 'f1' }));
    expect(out.status).toBe(422);
    expect(cancel).toHaveBeenCalled();
    expect(pulled()).toBeLessThan(40); // cap is ~15 chunks of 1MB; well short of all 100
  });

  it('422 for an unsupported content-type', async () => {
    mockFetch.mockImplementation(async (url: string) =>
      url.includes('/getFile')
        ? telegramOk()
        : new Response(new Uint8Array(10), { headers: { 'content-type': 'application/pdf' } }),
    );
    const res = await POST(req({ file_id: 'f1' }));
    expect(res.status).toBe(422);
    expect((await res.json()).details).toEqual(['unsupported_content_type']);
  });

  it('still succeeds when Telegram serves a real photo under a generic content-type (real-world quirk)', async () => {
    // Real magic bytes for a JPEG, served under a non-image Content-Type -- exactly what a real
    // Telegram Upload-Own test hit: the header alone said the file wasn't an image; the bytes prove it is.
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]);
    mockFetch.mockImplementation(async (url: string) =>
      url.includes('/getFile')
        ? telegramOk()
        : new Response(jpegBytes, { headers: { 'content-type': 'application/octet-stream' } }),
    );
    const res = await POST(req({ file_id: 'f1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toMatch(/assets\/telegram\/.*\.jpg$/);
    expect(mockS3Send).toHaveBeenCalledTimes(1);
    const put = mockS3Send.mock.calls[0][0].input;
    expect(put.ContentType).toBe('image/jpeg');
  });

  it('422 upload_failed when S3 put rejects', async () => {
    mockS3Send.mockRejectedValue(new Error('AccessDenied'));
    const res = await POST(req({ file_id: 'f1' }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('upload_failed');
  });

  it('happy path: uploads to assets/telegram/<uuid>.<ext> and returns the public S3 url; no token leak', async () => {
    const res = await POST(req({ file_id: 'f1' }));
    expect(res.status).toBe(200);
    expect(mockS3Send).toHaveBeenCalledTimes(1);
    const put = (mockS3Send.mock.calls[0][0] as { input: { Bucket: string; Key: string; ContentType: string } })
      .input;
    expect(put.Bucket).toBe('remotionlambda-useast1-riu6td7irs');
    expect(put.Key).toMatch(/^assets\/telegram\/[0-9a-f-]{36}\.jpg$/);
    expect(put.ContentType).toBe('image/jpeg');
    const json = await res.json();
    expect(json.url).toBe(`https://s3.us-east-1.amazonaws.com/remotionlambda-useast1-riu6td7irs/${put.Key}`);
    expect(JSON.stringify(json)).not.toContain(TOKEN);
  });
});

describe('static guard: the bot token URL is built in exactly two places, never echoed', () => {
  const srcPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'api', 'rehost-telegram-file.ts');
  const src = readFileSync(srcPath, 'utf8');
  const lines = src.split('\n');

  it('api.telegram.org appears on exactly two lines: the getFile call and the file-download call', () => {
    const telegramLines = lines.filter((l) => l.includes('api.telegram.org'));
    expect(telegramLines).toHaveLength(2);
    expect(telegramLines[0]).toContain('/bot${token}/getFile?file_id=');
    expect(telegramLines[1]).toContain('/file/bot${token}/');
  });

  it('no line that builds a Response.json(...) payload references the token or the telegram host', () => {
    const responseLines = lines.filter((l) => l.includes('Response.json'));
    expect(responseLines.length).toBeGreaterThan(0);
    for (const l of responseLines) {
      expect(l).not.toMatch(/token/i);
      expect(l).not.toMatch(/TELEGRAM_BOT_TOKEN/i);
      expect(l).not.toMatch(/api\.telegram\.org/i);
    }
  });
});
