// api/submit-render.ts
import { renderMediaOnLambda } from '@remotion/lambda/client';
import type { AwsRegion } from '@remotion/lambda/client';
import { validateRenderInput } from '../src/lib/validate.js';
import { redactMessage } from '../src/lib/redact.js';
import { rehostPhotos, REHOST_BUCKET, REHOST_REGION } from '../src/lib/rehost.js';
import type { PutObjectFn } from '../src/lib/rehost.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

// Same AWS identity the Remotion Lambda client uses (REMOTION_AWS_* env vars).
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

export async function POST(request: Request): Promise<Response> {
  const key = request.headers.get('x-trs-render-key');
  if (!key || key !== process.env.TRS_RENDER_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const required = [
    'REMOTION_AWS_ACCESS_KEY_ID',
    'REMOTION_AWS_SECRET_ACCESS_KEY',
    'REMOTION_REGION',
    'REMOTION_FUNCTION_NAME',
    'REMOTION_SERVE_URL',
  ];
  if (required.some((name) => !process.env[name])) {
    return Response.json({ error: 'server misconfigured' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return Response.json(
      { error: 'invalid input', details: ['request body must be a JSON object'] },
      { status: 400 },
    );
  }
  const { compositionId, inputProps, framesPerLambda } = body as {
    compositionId?: string;
    inputProps?: unknown;
    framesPerLambda?: unknown;
  };

  // Remotion's MINIMUM_FRAMES_PER_FUNCTION is 5 (@remotion/serverless-client validate-frames-per-function).
  if (framesPerLambda !== undefined && (typeof framesPerLambda !== 'number' || !Number.isInteger(framesPerLambda) || framesPerLambda < 5)) {
    return Response.json(
      { error: 'framesPerLambda must be an integer of at least 5 when provided' },
      { status: 400 },
    );
  }

  const validation = validateRenderInput(inputProps);
  if (!validation.ok) {
    return Response.json({ error: 'invalid input', details: validation.errors }, { status: 400 });
  }

  // Re-host every photo onto the Remotion bucket (some CDNs refuse Lambda's fetch). No fallback:
  // if any approved photo cannot be re-hosted, fail loudly so a human can re-upload it.
  const rehost = await rehostPhotos(validation.inputProps.beats, randomUUID(), {
    fetchFn: fetch,
    put: makePut(),
  });
  if (!rehost.ok) {
    return Response.json({ error: 'photo_unreachable', details: rehost.errors }, { status: 422 });
  }
  const renderProps = { ...validation.inputProps, beats: rehost.beats };

  try {
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: process.env.REMOTION_REGION! as AwsRegion,
      functionName: process.env.REMOTION_FUNCTION_NAME!,
      serveUrl: process.env.REMOTION_SERVE_URL!,
      composition: compositionId as string,
      codec: 'h264',
      inputProps: renderProps,
      ...(framesPerLambda !== undefined ? { framesPerLambda } : {}),
    });
    return Response.json({ render_id: renderId, bucket_name: bucketName, warnings: validation.warnings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: 'render submit failed', details: [redactMessage(msg)] },
      { status: 502 },
    );
  }
}

export const config = { runtime: 'nodejs' };
