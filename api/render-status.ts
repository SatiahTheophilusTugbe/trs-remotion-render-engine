// api/render-status.ts
import { getRenderProgress } from '@remotion/lambda/client';
import type { AwsRegion } from '@remotion/lambda/client';

export const config = { runtime: 'nodejs' };

export async function GET(request: Request): Promise<Response> {
  const key = request.headers.get('x-trs-render-key');
  if (!key || key !== process.env.TRS_RENDER_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const renderId = url.searchParams.get('render_id');
  const bucketName = url.searchParams.get('bucket_name');

  if (!renderId || !bucketName) {
    return new Response('render_id and bucket_name are required', { status: 400 });
  }

  const progress = await getRenderProgress({
    renderId,
    bucketName,
    functionName: process.env.REMOTION_FUNCTION_NAME!,
    region: process.env.REMOTION_REGION! as AwsRegion,
  });

  if (progress.fatalErrorEncountered) {
    return Response.json({ status: 'failed', progress: progress.overallProgress, render_url: null });
  }

  return Response.json({
    status: progress.done ? 'done' : 'rendering',
    progress: progress.overallProgress,
    render_url: progress.outputFile,
  });
}
