import { PROBE } from '../src/lib/validate.js';
export async function GET() { return Response.json({ probe: PROBE }); }
export const config = { runtime: 'nodejs' };
