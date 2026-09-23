// api/_auth.ts
// Shared shared-secret auth check for the render API endpoints.
// Vercel does not treat underscore-prefixed files in api/ as routes, so this
// stays a plain helper module rather than becoming its own endpoint.

export function isAuthorized(request: Request): boolean {
  const key = request.headers.get('x-trs-render-key');
  return !!key && key === process.env.TRS_RENDER_API_KEY;
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
