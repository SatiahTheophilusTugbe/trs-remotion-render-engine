// api/submit-render.ts
import { renderMediaOnLambda } from '@remotion/lambda/client';
import type { AwsRegion } from '@remotion/lambda/client';
import { isAuthorized, unauthorizedResponse } from './_auth';

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  const { compositionId, inputProps } = await request.json();

  const { renderId, bucketName } = await renderMediaOnLambda({
    region: process.env.REMOTION_REGION! as AwsRegion,
    functionName: process.env.REMOTION_FUNCTION_NAME!,
    serveUrl: process.env.REMOTION_SERVE_URL!,
    composition: compositionId,
    codec: 'h264',
    inputProps,
  });

  return Response.json({ render_id: renderId, bucket_name: bucketName });
}

export const config = { runtime: 'nodejs' };
