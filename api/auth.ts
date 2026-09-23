// api/auth.ts
// Shared shared-secret auth check for the render API endpoints.
// Not named api/_auth.ts: Vercel's build excludes underscore-prefixed files
// in api/ from the deployed bundle entirely (confirmed in production via
// "Cannot find module '/var/task/api/_auth'"), not just from routing as
// initially assumed. This plain file has no GET/POST/fetch export, so it
// isn't itself invokable as a route even without the underscore.

export function isAuthorized(request: Request): boolean {
  const key = request.headers.get('x-trs-render-key');
  return !!key && key === process.env.TRS_RENDER_API_KEY;
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
