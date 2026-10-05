// api/rehost-telegram-file.ts
//
// Fetches a Telegram-uploaded photo server-side and re-hosts it on the Remotion S3 bucket, so the
// Telegram bot token never has to live in n8n workflow source or in any persisted URL (Sheet row,
// callback payload). The token is read once from TELEGRAM_BOT_TOKEN and used only to build the two
// Telegram API URLs below; it must never appear in a response, log, or thrown error message.
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  REHOST_BUCKET,
  REHOST_REGION,
  FETCH_TIMEOUT_MS,
  allowedImageType,
  sniffImageType,
  extForContentType,
  publicUrl,
  readCapped,
  RehostFailure,
} from '../src/lib/rehost.js';
import type { PutObjectFn } from '../src/lib/rehost.js';
import { imageDimensions } from '../src/lib/imageDims.js';
import { redactMessage } from '../src/lib/redact.js';

// Same AWS identity/bucket the photo-rehosting path in submit-render.ts uses.
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

// New prefix, distinct from submit-render's `assets/<renderId>/<position>.<ext>`, so the two never collide.
const telegramObjectKey = (ext: string): string => `assets/telegram/${randomUUID()}.${ext}`;

type TelegramGetFileResponse = {
  ok?: boolean;
  description?: string;
  result?: { file_path?: string };
};

const timedOut = (err: unknown): boolean => {
  const name = err instanceof Error ? err.name : '';
  return name === 'TimeoutError' || name === 'AbortError';
};

export async function POST(request: Request): Promise<Response> {
  const key = request.headers.get('x-trs-render-key');
  if (!key || key !== process.env.TRS_RENDER_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const required = ['TELEGRAM_BOT_TOKEN', 'REMOTION_AWS_ACCESS_KEY_ID', 'REMOTION_AWS_SECRET_ACCESS_KEY'];
  if (required.some((name) => !process.env[name])) {
    return Response.json({ error: 'server misconfigured' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const fileId =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as { file_id?: unknown }).file_id
      : undefined;
  if (typeof fileId !== 'string' || fileId === '') {
    return Response.json(
      { error: 'invalid input', details: ['file_id missing or not a string'] },
      { status: 400 },
    );
  }

  // The token lives only in this function and only inside these two URL constructions. It must
  // never be interpolated into anything returned to the caller, logged, or thrown as an error.
  const token = process.env.TELEGRAM_BOT_TOKEN!;

  let filePath: string;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    let json: TelegramGetFileResponse | null;
    try {
      json = (await res.json()) as TelegramGetFileResponse;
    } catch {
      json = null;
    }
    if (!res.ok || !json?.ok || typeof json.result?.file_path !== 'string') {
      const detail = json?.description ? redactMessage(json.description) : `http_${res.status}`;
      return Response.json({ error: 'telegram_error', details: [detail] }, { status: 502 });
    }
    filePath = json.result.file_path;
  } catch (err) {
    return Response.json(
      { error: 'telegram_error', details: [timedOut(err) ? 'timeout' : 'network_error'] },
      { status: 502 },
    );
  }

  const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

  let bytes: Uint8Array;
  let mime: string;
  try {
    const res = await fetch(fileUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return Response.json({ error: 'telegram_error', details: [`http_${res.status}`] }, { status: 502 });
    }
    const headerType = allowedImageType(res.headers.get('content-type'));
    bytes = await readCapped(res);
    const type = headerType ?? sniffImageType(bytes);
    if (!type) {
      return Response.json(
        { error: 'invalid input', details: ['unsupported_content_type'] },
        { status: 422 },
      );
    }
    mime = type;
  } catch (err) {
    if (err instanceof RehostFailure) {
      // readCapped only ever throws too_large / empty_body: both are photo-content problems, not a
      // Telegram-side failure.
      return Response.json({ error: 'invalid input', details: [String(err.reason)] }, { status: 422 });
    }
    return Response.json(
      { error: 'telegram_error', details: [timedOut(err) ? 'timeout' : 'network_error'] },
      { status: 502 },
    );
  }

  const objectKey = telegramObjectKey(extForContentType(mime)!);
  try {
    await makePut()({ key: objectKey, body: bytes, contentType: mime });
  } catch {
    return Response.json({ error: 'upload_failed', details: ['upload_failed'] }, { status: 422 });
  }

  // Size lets 13b warn about small uploads (to-do A6, 2026-10-05); null when the header can't be read.
  const dims = imageDimensions(bytes);
  return Response.json({ url: publicUrl(objectKey), width: dims?.width ?? null, height: dims?.height ?? null });
}

export const config = { runtime: 'nodejs' };
