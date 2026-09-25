// Production-length (~45s) proof through the LIVE API. Prints no media URLs.
// Usage (PowerShell, from the repo folder):
//   $env:TRS_RENDER_API_KEY = Read-Host "Render key"
//   node scripts/length-proof.mjs
// Needs the gitignored out/proof-media.json (avatarPhoto, avatarClipStandin, brollPhoto,
// brollAudio, music, avatarPhotoCdnNba).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const key = process.env.TRS_RENDER_API_KEY;
if (!key) {
  console.error('Set $env:TRS_RENDER_API_KEY first.');
  process.exit(1);
}

const FPS = 30;
const MAX_INVOCATIONS = 9;
const fixture = JSON.parse(readFileSync('src/fixtures/real-story-ballmer.json', 'utf8'));
const avatar = fixture.find((b) => b.type === 'avatar');
const broll = fixture.find((b) => b.type === 'broll');
let media;
try {
  media = JSON.parse(readFileSync('out/proof-media.json', 'utf8'));
} catch {
  console.error('Missing out/proof-media.json (gitignored).');
  process.exit(1);
}
for (const k of ['avatarPhoto', 'avatarClipStandin', 'brollPhoto', 'brollAudio', 'music', 'avatarPhotoCdnNba']) {
  if (!media[k]) {
    console.error(`out/proof-media.json is missing key: ${k}`);
    process.exit(1);
  }
}

const statBeat = (i, duration_sec, stat, photo_url) => ({
  beat_index: i, type: 'stat', duration_sec, photo_url, overlay_text: '', narration_line: '', stat,
});
const beats = [
  { ...broll, beat_index: 0, photo_url: media.brollPhoto, audio_url: media.brollAudio, clip_url: '' },
  statBeat(1, 3, { value: 1250, label: 'Career points', prefix: '', suffix: '', decimals: 0 }, media.brollPhoto),
  { ...avatar, beat_index: 2, photo_url: media.avatarPhoto, clip_url: media.avatarClipStandin },
  statBeat(3, 3, { value: 1250, label: 'Career points', prefix: '', suffix: '', decimals: 0 }, media.avatarPhoto),
  // photo on a host that fails on Lambda directly: proves server-side re-hosting
  { ...broll, beat_index: 4, photo_url: media.avatarPhotoCdnNba, audio_url: media.brollAudio, clip_url: '' },
  statBeat(5, 2, { value: 1250, label: 'Career points', prefix: '', suffix: '', decimals: 0 }, media.avatarPhotoCdnNba),
];

const totalSec = beats.reduce((s, b) => s + b.duration_sec, 0);
const totalFrames = beats.reduce((s, b) => s + Math.round(b.duration_sec * FPS), 0);
const framesPerLambda = Math.max(20, Math.ceil(totalFrames / 8));
const invocations = Math.ceil(totalFrames / framesPerLambda) + 1;
console.log(`beats=${beats.length} totalSec=${totalSec.toFixed(1)} totalFrames=${totalFrames} framesPerLambda=${framesPerLambda} expectedInvocations=${invocations}`);
if (invocations > MAX_INVOCATIONS) {
  console.error(`Abort: ${invocations} invocations exceeds the ${MAX_INVOCATIONS} limit (concurrency cap 10).`);
  process.exit(1);
}

const inputProps = { fps: FPS, leagueBadge: 'NBA', musicUrl: media.music, transitions: true, beats };
mkdirSync('out', { recursive: true });
writeFileSync('out/length-props.json', JSON.stringify(inputProps, null, 2), 'utf8');

const base = JSON.parse(readFileSync('deploy-manifest.json', 'utf8')).apiBaseUrl;
const headers = { 'content-type': 'application/json', 'x-trs-render-key': key };
const t0 = Date.now();

const submit = await fetch(`${base}/api/submit-render`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ compositionId: 'BeatSequence', inputProps, framesPerLambda }),
});
if (!submit.ok) {
  let body = {};
  try { body = await submit.json(); } catch { /* non-JSON */ }
  console.error('submit failed', submit.status, body.error ?? '');
  if (Array.isArray(body.details)) for (const d of body.details) console.error(' -', d);
  process.exit(1);
}
const sub = await submit.json();
const { render_id, bucket_name } = sub;
console.log('render_id', render_id);
console.log('submit warnings:', JSON.stringify(sub.warnings ?? []));

let last;
for (let i = 0; i < 240; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  let res;
  try {
    res = await fetch(`${base}/api/render-status?render_id=${render_id}&bucket_name=${bucket_name}`, { headers });
  } catch (e) {
    console.log('status poll network error (retrying)');
    continue;
  }
  if (res.status >= 500) {
    console.log('status poll', res.status, '(retrying)');
    continue;
  }
  last = await res.json();
  console.log('status', last.status, Math.round((last.progress ?? 0) * 100) + '%', `${Math.round((Date.now() - t0) / 1000)}s`);
  if (last.status === 'done' || last.status === 'failed') break;
}

const secs = Math.round((Date.now() - t0) / 1000);
if (last?.status !== 'done') {
  console.error(`not done after ${secs}s; structured error:`, JSON.stringify(last?.error ?? last));
  process.exit(1);
}
console.log(`done: wall-clock ${secs}s`);
const video = await fetch(last.render_url);
writeFileSync('out/length-proof.mp4', Buffer.from(await video.arrayBuffer()));
console.log('saved out/length-proof.mp4');
