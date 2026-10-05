// api/render-thumbnail.ts
import { renderStillOnLambda } from '@remotion/lambda/client';
import type { AwsRegion } from '@remotion/lambda/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { validateThumbnailInput, thumbLayout } from '../src/lib/thumbnail.js';
import { rehostPhotos, REHOST_BUCKET, REHOST_REGION } from '../src/lib/rehost.js';
import type { PutObjectFn, RehostBeat } from '../src/lib/rehost.js';
import { redactMessage } from '../src/lib/redact.js';

const MAX_THUMB_BYTES = 2 * 1024 * 1024; // YouTube's custom-thumbnail limit

function makePut(): PutObjectFn {
  const s3 = new S3Client({
    region: REHOST_REGION,
    credentials: { accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY! },
  });
  return async ({ key, body, contentType }) => {
    await s3.send(new PutObjectCommand({ Bucket: REHOST_BUCKET, Key: key, Body: body, ContentType: contentType }));
  };
}

export async function POST(request: Request): Promise<Response> {
  const key = request.headers.get('x-trs-render-key');
  if (!key || key !== process.env.TRS_RENDER_API_KEY) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const required = ['REMOTION_AWS_ACCESS_KEY_ID', 'REMOTION_AWS_SECRET_ACCESS_KEY', 'REMOTION_REGION', 'REMOTION_FUNCTION_NAME', 'REMOTION_SERVE_URL'];
  if (required.some((n) => !process.env[n])) return Response.json({ error: 'server misconfigured' }, { status: 500 });

  let body: unknown = null;
  try { body = await request.json(); } catch { body = null; }
  const v = validateThumbnailInput(body);
  if (!v.ok) return Response.json({ error: 'invalid input', details: v.errors }, { status: 400 });

  const rehost = await rehostPhotos<RehostBeat>([{ photo_url: v.props.photo_url, beat_index: 0 }], randomUUID(), { fetchFn: fetch, put: makePut() });
  if (!rehost.ok) return Response.json({ error: 'photo_unreachable', details: rehost.errors }, { status: 422 });
  const hosted = rehost.beats[0];
  const inputProps = { ...v.props, photo_url: hosted.photo_url as string, photo_w: hosted.photo_w, photo_h: hosted.photo_h };

  const render = (jpegQuality: number) =>
    renderStillOnLambda({
      region: process.env.REMOTION_REGION! as AwsRegion,
      functionName: process.env.REMOTION_FUNCTION_NAME!,
      serveUrl: process.env.REMOTION_SERVE_URL!,
      composition: 'Thumbnail',
      inputProps,
      imageFormat: 'jpeg',
      jpegQuality,
      privacy: 'public',
    });
  try {
    let out = await render(85);
    if (out.sizeInBytes > MAX_THUMB_BYTES) out = await render(75);
    if (out.sizeInBytes > MAX_THUMB_BYTES) return Response.json({ error: 'render failed', details: ['thumbnail over 2 MB'] }, { status: 502 });
    return Response.json({ thumbnail_url: out.url, layout: thumbLayout(v.props.stat) });
  } catch (err) {
    return Response.json({ error: 'render failed', details: [redactMessage(err instanceof Error ? err.message : String(err))] }, { status: 502 });
  }
}

export const config = { runtime: 'nodejs' };
