// api/submit-render.ts
import { renderMediaOnLambda } from '@remotion/lambda/client';
import type { AwsRegion } from '@remotion/lambda/client';
import { validateRenderInput } from '../src/lib/validate.js';

export async function POST(request: Request): Promise<Response> {
  const key = request.headers.get('x-trs-render-key');
  if (!key || key !== process.env.TRS_RENDER_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { compositionId, inputProps, framesPerLambda } = await request.json();

  // Remotion's MINIMUM_FRAMES_PER_FUNCTION is 5 (@remotion/serverless-client validate-frames-per-function).
  if (framesPerLambda !== undefined && (!Number.isInteger(framesPerLambda) || framesPerLambda < 5)) {
    return Response.json(
      { error: 'framesPerLambda must be an integer of at least 5 when provided' },
      { status: 400 },
    );
  }

  const validation = validateRenderInput(inputProps);
  if (!validation.ok) {
    return Response.json({ error: 'invalid input', details: validation.errors }, { status: 400 });
  }

  const { renderId, bucketName } = await renderMediaOnLambda({
    region: process.env.REMOTION_REGION! as AwsRegion,
    functionName: process.env.REMOTION_FUNCTION_NAME!,
    serveUrl: process.env.REMOTION_SERVE_URL!,
    composition: compositionId,
    codec: 'h264',
    inputProps,
    ...(framesPerLambda !== undefined ? { framesPerLambda } : {}),
  });

  return Response.json({ render_id: renderId, bucket_name: bucketName, warnings: validation.warnings });
}

export const config = { runtime: 'nodejs' };
