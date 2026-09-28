/* global console, process */
// Temporary localhost media server for the grade bake-off (gitignored out/media only).
// Usage: node src/bakeoff/grade/serve-media.mjs   (STOP it when done). Range + CORS supported.
import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const ROOT = join(process.cwd(), 'out', 'media');
const PORT = Number(process.env.GRADE_MEDIA_PORT ?? 8765);
const TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };

createServer((req, res) => {
  const name = basename(decodeURIComponent((req.url ?? '').split('?')[0]));
  const file = join(ROOT, name);
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!name || !existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const size = statSync(file).size;
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
    createReadStream(file).pipe(res);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`grade media server on ${PORT}`));
