import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@remotion/lambda/client', () => ({ renderMediaOnLambda: vi.fn() }));

import { renderMediaOnLambda } from '@remotion/lambda/client';
import { POST } from '../../api/submit-render';

const mockRender = vi.mocked(renderMediaOnLambda);
const KEY = 'test-key';

const beat = (o: object = {}) => ({
  type: 'broll', photo_url: 'https://example.com/p.jpg', narration_line: 'hi',
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
});
