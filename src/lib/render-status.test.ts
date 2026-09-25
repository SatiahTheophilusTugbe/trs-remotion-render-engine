import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@remotion/lambda/client', () => ({ getRenderProgress: vi.fn() }));

import { getRenderProgress } from '@remotion/lambda/client';
import { GET } from '../../api/render-status';

const mockProgress = vi.mocked(getRenderProgress);
const KEY = 'test-key';
const req = (qs = 'render_id=r1&bucket_name=b1', key: string | null = KEY) =>
  new Request(`https://x.test/api/render-status?${qs}`, {
    headers: key ? { 'x-trs-render-key': key } : {},
  });

beforeEach(() => {
  process.env.TRS_RENDER_API_KEY = KEY;
  process.env.REMOTION_REGION = 'us-east-1';
  process.env.REMOTION_FUNCTION_NAME = 'fn';
  mockProgress.mockReset();
});

describe('GET /api/render-status', () => {
  it('401 without key, before calling AWS', async () => {
    expect((await GET(req(undefined, null))).status).toBe(401);
    expect(mockProgress).not.toHaveBeenCalled();
  });

  it('400 when params missing', async () => {
    expect((await GET(req('render_id=r1'))).status).toBe(400);
    expect(mockProgress).not.toHaveBeenCalled();
  });

  it('rendering / done shapes unchanged', async () => {
    mockProgress.mockResolvedValueOnce({ done: false, overallProgress: 0.4, fatalErrorEncountered: false } as never);
    let json = await (await GET(req())).json();
    expect(json).toEqual({ status: 'rendering', progress: 0.4, render_url: null });
    mockProgress.mockResolvedValueOnce({
      done: true, overallProgress: 1, fatalErrorEncountered: false, outputFile: 'https://s3/out.mp4',
    } as never);
    const res = await GET(req());
    expect(res.status).toBe(200);
    json = await res.json();
    expect(json).toEqual({ status: 'done', progress: 1, render_url: 'https://s3/out.mp4' });
  });

  it('failed shape unchanged and redacted', async () => {
    mockProgress.mockResolvedValueOnce({
      fatalErrorEncountered: true, overallProgress: 0.2,
      errors: [{ type: 'renderer', isFatal: true, message: 'Bad https://cdn.example.invalid/p.jpg?tok=SECRET\nstack line' }],
    } as never);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('failed');
    expect(json.error).toEqual({ type: 'renderer', is_fatal: true, message: 'Bad <url:cdn.example.invalid>' });
  });

  it.each([
    ['TooManyRequestsException', Object.assign(new Error('Rate Exceeded.'), { name: 'TooManyRequestsException' })],
    ['ThrottlingException', Object.assign(new Error('Rate exceeded'), { name: 'ThrottlingException' })],
    ['ECONNRESET', new Error('read ECONNRESET')],
    ['fetch failed', new TypeError('fetch failed')],
  ])('503 retryable on %s', async (_l, err) => {
    mockProgress.mockRejectedValueOnce(err);
    const res = await GET(req());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe('unknown');
    expect(json.retryable).toBe(true);
    expect(typeof json.error).toBe('string');
  });

  it('500 non-retryable on generic error', async () => {
    mockProgress.mockRejectedValueOnce(new Error('Function not found'));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: 'error', retryable: false, error: 'Function not found' });
  });

  it('500 on non-Error throws', async () => {
    mockProgress.mockRejectedValueOnce('weird');
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('weird');
  });

  it('never leaks URLs, tokens or second lines in error', async () => {
    const leaky = 'Failed https://user:pw@s3.example.invalid/k?sig=SECRET bot123456:ABC-def_GHI\nsecond line SECRETLINE';
    for (const err of [new Error(leaky), Object.assign(new Error('Rate Exceeded ' + leaky), { name: 'ThrottlingException' })]) {
      mockProgress.mockRejectedValueOnce(err);
      const res = await GET(req());
      const text = JSON.stringify(await res.json());
      expect(text).not.toMatch(/SECRET|pw@|ABC-def|second line|sig=/);
    }
  });
});
