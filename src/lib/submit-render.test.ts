import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@remotion/lambda/client', () => ({ renderMediaOnLambda: vi.fn() }));

vi.mock('node:dns/promises', () => ({ lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]) }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function () { return { send: (cmd: unknown) => mockS3Send(cmd) }; }),
  PutObjectCommand: vi.fn(function (input: unknown) { return { input }; }),
}));

import { renderMediaOnLambda } from '@remotion/lambda/client';
import { POST } from '../../api/submit-render';

const mockRender = vi.mocked(renderMediaOnLambda);
const mockS3Send = vi.fn();
const mockFetch = vi.fn();
const KEY = 'test-key';

const beat = (o: object = {}) => ({
  type: 'broll', photo_url: 'https://cdn.example.invalid/p.jpg?tok=SECRET', narration_line: 'hi',
  duration_sec: 5, beat_index: 0, ...o,
});
const req = (body: unknown, key: string | null = KEY, raw = false) =>
  new Request('https://x.test/api/submit-render', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-trs-render-key': key } : {}) },
    body: raw ? (body as string) : JSON.stringify(body),
  });

beforeEach(() => {
  process.env.TRS_RENDER_API_KEY = KEY;
  process.env.REMOTION_REGION = 'us-east-1';
  process.env.REMOTION_FUNCTION_NAME = 'fn';
  process.env.REMOTION_SERVE_URL = 'https://serve.example.invalid';
  process.env.REMOTION_AWS_ACCESS_KEY_ID = 'AKIAEXAMPLE';
  process.env.REMOTION_AWS_SECRET_ACCESS_KEY = 'secret';
  mockS3Send.mockReset();
  mockS3Send.mockResolvedValue({});
  mockFetch.mockReset();
  mockFetch.mockImplementation(async () => new Response(new Uint8Array(8), { headers: { 'content-type': 'image/jpeg' } }));
  vi.stubGlobal('fetch', mockFetch);
  mockRender.mockReset();
  mockRender.mockResolvedValue({ renderId: 'r1', bucketName: 'b1' } as never);
});

describe('POST /api/submit-render', () => {
  it('401 without or with wrong key', async () => {
    expect((await POST(req({}, null))).status).toBe(401);
    expect((await POST(req({}, 'nope'))).status).toBe(401);
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('submits NORMALISED props and returns warnings', async () => {
    const long = 'a'.repeat(120);
    const res = await POST(
      req({ compositionId: 'C', inputProps: { beats: [beat({ overlay_text: long, duration_sec: '5' })] } }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.render_id).toBe('r1');
    expect(json.bucket_name).toBe('b1');
    expect(Array.isArray(json.warnings)).toBe(true);
    expect(json.warnings.join()).toMatch(/overlay_text/);
    const sent = mockRender.mock.calls[0][0].inputProps as { fps: number; beats: { overlay_text: string; duration_sec: number }[] };
    expect(sent.fps).toBe(30);
    expect(sent.beats[0].overlay_text).toHaveLength(80);
    expect(sent.beats[0].duration_sec).toBe(5);
  });

  it('400 with details for an invalid beat; nothing submitted', async () => {
    const res = await POST(req({ compositionId: 'C', inputProps: { beats: [beat({ photo_url: null })] } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid input');
    expect(json.details.join()).toMatch(/photo_url missing/);
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('400 for non-JSON, null and array bodies', async () => {
    for (const [b, raw] of [['not json{', true], ['null', true], ['[1]', true]] as const) {
      const res = await POST(req(b, KEY, raw));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: 'invalid input',
        details: ['request body must be a JSON object'],
      });
    }
  });

  it('framesPerLambda validation unchanged', async () => {
    const res = await POST(req({ compositionId: 'C', framesPerLambda: 2, inputProps: { beats: [beat()] } }));
    expect(res.status).toBe(400);
  });

  it('502 with redacted first line when Lambda submit rejects', async () => {
    mockRender.mockRejectedValue(
      new Error('boom fetching https://api.telegram.org/file/bot123456:SECRET-tok/x.jpg?a=1\nsecond line'),
    );
    const res = await POST(req({ compositionId: 'C', inputProps: { beats: [beat()] } }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe('render submit failed');
    expect(json.details).toHaveLength(1);
    expect(json.details[0]).toContain('<url:api.telegram.org>');
    expect(json.details[0]).not.toMatch(/SECRET|second line/);
  });

  it('re-hosts photos: S3 URL replaces photo_url in props sent to Lambda', async () => {
    const res = await POST(
      req({ compositionId: 'C', inputProps: { beats: [beat(), beat({ beat_index: 1 })] } }),
    );
    expect(res.status).toBe(200);
    expect(mockS3Send).toHaveBeenCalledTimes(2);
    const put = (mockS3Send.mock.calls[0][0] as { input: { Bucket: string; Key: string; ContentType: string } }).input;
    expect(put.Bucket).toBe('remotionlambda-useast1-riu6td7irs');
    expect(put.Key).toMatch(/^assets\/[0-9a-f-]{36}\/0\.jpg$/);
    expect(put.ContentType).toBe('image/jpeg');
    const sent = mockRender.mock.calls[0][0].inputProps as { beats: { photo_url: string }[] };
    expect(sent.beats[0].photo_url).toBe(
      `https://s3.us-east-1.amazonaws.com/remotionlambda-useast1-riu6td7irs/${put.Key}`,
    );
    expect(sent.beats[1].photo_url).toMatch(/\/1\.jpg$/);
    expect(JSON.stringify(sent)).not.toMatch(/example\.invalid/);
  });

  it('422 photo_unreachable when a photo cannot be fetched; Lambda NOT called; no URL leak', async () => {
    mockFetch.mockImplementation(async () => new Response('denied', { status: 403 }));
    const res = await POST(req({ compositionId: 'C', inputProps: { beats: [beat()] } }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('photo_unreachable');
    expect(json.details).toEqual([
      'beat 0 (position 0): photo could not be fetched (host=cdn.example.invalid, status=403)',
    ]);
    expect(JSON.stringify(json)).not.toMatch(/SECRET|tok=|https?:/);
    expect(mockRender).not.toHaveBeenCalled();
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it('422 when the S3 upload fails; Lambda NOT called', async () => {
    mockS3Send.mockRejectedValue(new Error('AccessDenied'));
    const res = await POST(req({ compositionId: 'C', inputProps: { beats: [beat()] } }));
    expect(res.status).toBe(422);
    expect((await res.json()).details[0]).toContain('status=upload_failed');
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('500 server misconfigured (no values) when AWS/Remotion env is missing; nothing fetched', async () => {
    for (const name of ['REMOTION_AWS_ACCESS_KEY_ID', 'REMOTION_AWS_SECRET_ACCESS_KEY', 'REMOTION_REGION', 'REMOTION_FUNCTION_NAME', 'REMOTION_SERVE_URL']) {
      const saved = process.env[name];
      delete process.env[name];
      const res = await POST(req({ compositionId: 'C', inputProps: { beats: [beat()] } }));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'server misconfigured' });
      process.env[name] = saved;
    }
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('401 still wins over misconfiguration', async () => {
    delete process.env.REMOTION_AWS_ACCESS_KEY_ID;
    expect((await POST(req({}, 'nope'))).status).toBe(401);
  });
});
