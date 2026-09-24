// Live-API proof: submit the real-story payload through the deployed Vercel API, poll, download.
// Usage (PowerShell):
//   $env:TRS_RENDER_API_KEY = Read-Host   # paste key, not echoed to chat
//   node scripts/build-real-props.mjs --music | Out-File -Encoding utf8 out/live-props.json   (or any encoding; script handles UTF-16)
//   node scripts/live-proof.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const key = process.env.TRS_RENDER_API_KEY;
if (!key) {
  console.error('Set $env:TRS_RENDER_API_KEY first.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync('deploy-manifest.json', 'utf8'));
const base = manifest.apiBaseUrl;
// PowerShell 5.1 `>` writes UTF-16 LE with a BOM; accept that as well as UTF-8.
const raw = readFileSync('out/live-props.json');
const text = raw[0] === 0xff && raw[1] === 0xfe ? raw.toString('utf16le') : raw.toString('utf8');
const inputProps = JSON.parse(text.replace(/^﻿/, ''));
const headers = { 'content-type': 'application/json', 'x-trs-render-key': key };

const submit = await fetch(`${base}/api/submit-render`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ compositionId: 'BeatSequence', inputProps, framesPerLambda: 105 }),
});
if (!submit.ok) {
  console.error('submit failed', submit.status, (await submit.text()).slice(0, 200));
  process.exit(1);
}
const { render_id, bucket_name } = await submit.json();
console.log('submitted render_id', render_id);

let last;
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const res = await fetch(
    `${base}/api/render-status?render_id=${render_id}&bucket_name=${bucket_name}`,
    { headers },
  );
  if (res.status >= 500) {
    console.log('status poll', res.status, '(retrying)');
    continue;
  }
  last = await res.json();
  console.log('status', last.status, Math.round((last.progress ?? 0) * 100) + '%');
  if (last.status === 'done' || last.status === 'failed') break;
}

if (last?.status !== 'done') {
  console.error('not done:', JSON.stringify(last?.error ?? last));
  process.exit(1);
}
const video = await fetch(last.render_url);
writeFileSync('out/g3-live-api.mp4', Buffer.from(await video.arrayBuffer()));
console.log('saved out/g3-live-api.mp4');
