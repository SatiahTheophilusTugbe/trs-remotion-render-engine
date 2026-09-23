// api/submit-render.ts
import { renderMediaOnLambda } from '@remotion/lambda/client';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { compositionId, inputProps } = await req.json();

  const { renderId, bucketName } = await renderMediaOnLambda({
    region: process.env.REMOTION_REGION!,
    functionName: process.env.REMOTION_FUNCTION_NAME!,
    serveUrl: process.env.REMOTION_SERVE_URL!,
    composition: compositionId,
    codec: 'h264',
    inputProps,
  });

  return Response.json({ render_id: renderId, bucket_name: bucketName });
}

export const config = { runtime: 'nodejs' };
