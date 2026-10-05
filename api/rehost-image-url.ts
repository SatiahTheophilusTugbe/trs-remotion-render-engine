// api/rehost-image-url.ts
//
// Pasted-link uploads (2026-10-04): 13b sends the image address the owner pasted in Telegram. The image
// is fetched server-side through the same SSRF guard as the render photo rehost (every redirect hop is
// re-checked), validated (JPEG/PNG/WebP, at least 600px on one side, 10 MB cap) and re-hosted on the
// Remotion S3 bucket. Errors return a short owner-facing reason and never echo the pasted URL.
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  REHOST_BUCKET,
  REHOST_REGION,
  defaultResolve,
  extForContentType,
  guardedFetch,
  publicUrl,
  readCapped,
} from '../src/lib/rehost.js';
import type { PutObjectFn } from '../src/lib/rehost.js';
import { checkImage, linkFailureReason, normaliseLink, LINK_TIMEOUT_MS } from '../src/lib/rehostUrl.js';

function makePut(): PutObjectFn {
  const s3 = new S3Client({
    region: REHOST_REGION,
    credentials: {
      accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
    },
  });
  return async ({ key, body, contentType }) => {
    await s3.send(new PutObjectCommand({ Bucket: REHOST_BUCKET, Key: key, Body: body, ContentType: contentType }));
  };
}

const unusable = (reason: string) => Response.json({ error: 'unusable', reason }, { status: 422 });

export async function POST(request: Request): Promise<Response> {
  const key = request.headers.get('x-trs-render-key');
  if (!key || key !== process.env.TRS_RENDER_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (['REMOTION_AWS_ACCESS_KEY_ID', 'REMOTION_AWS_SECRET_ACCESS_KEY'].some((n) => !process.env[n])) {
    return Response.json({ error: 'server misconfigured' }, { status: 500 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const raw = typeof body === 'object' && body !== null ? (body as { url?: unknown }).url : undefined;
  const url = normaliseLink(raw);
  if (!url) return unusable('bad link');

  let bytes: Uint8Array;
  try {
    const res = await guardedFetch(url, fetch, defaultResolve, AbortSignal.timeout(LINK_TIMEOUT_MS));
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return unusable('site blocked the download');
    }
    bytes = await readCapped(res);
  } catch (err) {
    return unusable(linkFailureReason(err));
  }

  const check = checkImage(bytes);
  if (!check.ok) return unusable(check.reason);

  const objectKey = `assets/links/${randomUUID()}.${extForContentType(check.mime)}`;
  try {
    await makePut()({ key: objectKey, body: bytes, contentType: check.mime });
  } catch {
    return Response.json({ error: 'upload_failed' }, { status: 502 });
  }
  return Response.json({ url: publicUrl(objectKey), width: check.width, height: check.height });
}

export const config = { runtime: 'nodejs' };
