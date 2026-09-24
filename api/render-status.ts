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
    const first = progress.errors[0];
    return Response.json({
      status: 'failed',
      progress: progress.overallProgress,
      render_url: null,
      error: first
        ? {
            type: first.type,
            is_fatal: first.isFatal,
            message: first.message
              .split('\n')[0]
              .replace(/https?:\/\/(?:[^\s\/@]*@)?([^\s\/?#:]+)\S*/g, '<url:$1>')
              .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot<redacted>')
              .slice(0, 300),
          }
        : null,
    });
  }

  return Response.json({
    status: progress.done ? 'done' : 'rendering',
    progress: progress.overallProgress,
    render_url: progress.outputFile ?? null,
  });
}
