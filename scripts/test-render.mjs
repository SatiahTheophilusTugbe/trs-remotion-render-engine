// scripts/test-render.mjs
// Usage: node --env-file=.env scripts/test-render.mjs [short|full|g4]
// Renders the real BeatSequence composition directly on Lambda (bypasses the Vercel API).
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../deploy-manifest.json', import.meta.url)));

const mode = process.argv[2] ?? 'short';
if (mode !== 'short' && mode !== 'full' && mode !== 'g4') {
  console.error('Usage: node --env-file=.env scripts/test-render.mjs [short|full|g4]');
  process.exit(1);
}

const PHOTO_URL =
  'https://www.aljazeera.com/wp-content/uploads/2026/08/AFP__20260826__C6KX2G4__v2__MidRes__FblEspLigaRealMadridRealSociedad-1787778745.jpg?resize=770%2C513&quality=80';
const CLIP_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';
const AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

const avatarSec = mode === 'g4' ? 4 : mode === 'full' ? 5 : 2;
const brollSec = mode === 'g4' ? 4 : mode === 'full' ? 4 : 2;

const beats = [
  {
    type: 'avatar',
    photo_url: PHOTO_URL,
    clip_url: CLIP_URL,
    overlay_text: '',
    narration_line: 'Real Lambda proof avatar beat.',
    duration_sec: avatarSec,
    beat_index: 0,
  },
  {
    type: 'broll',
    photo_url: PHOTO_URL,
    audio_url: AUDIO_URL,
    overlay_text: 'REAL LAMBDA PROOF',
    narration_line: 'Real Lambda proof b-roll beat.',
    duration_sec: brollSec,
    beat_index: mode === 'g4' ? 2 : 1,
  },
];

if (mode === 'g4') {
  // avatar 4s + stat 3s + broll 4s = 11s = 330 frames; two cuts at frames 120 and 210.
  beats.splice(1, 0, {
    type: 'stat',
    photo_url: PHOTO_URL,
    audio_url: AUDIO_URL,
    overlay_text: '',
    narration_line: 'Real Lambda proof stat beat.',
    stat: { value: 1250, label: 'Career points' },
    duration_sec: 3,
    beat_index: 1,
  });
}

console.log(`Mode: ${mode} (${beats.length} beats)`);

const { renderId, bucketName } = await renderMediaOnLambda({
  region: manifest.region,
  functionName: manifest.functionName,
  serveUrl: manifest.serveUrl,
  composition: 'BeatSequence',
  codec: 'h264',
  inputProps: { beats, fps: 30 },
  // Account Lambda concurrency limit is currently 10; default chunking needs 15 invocations for 270 frames, framesPerLambda: 45 needs 7.
  // g4: 330 frames / 60 = 6 chunks + 1 = 7 invocations.
  ...(mode === 'full' ? { framesPerLambda: 45 } : {}),
  ...(mode === 'g4' ? { framesPerLambda: 60 } : {}),
});

console.log('renderId:', renderId, 'bucketName:', bucketName);

let progress;
do {
  await new Promise((r) => setTimeout(r, 3000));
  progress = await getRenderProgress({
    renderId,
    bucketName,
    functionName: manifest.functionName,
    region: manifest.region,
  });
  console.log(`progress: ${Math.round(progress.overallProgress * 100)}%`);
} while (!progress.done && !progress.fatalErrorEncountered);

if (progress.fatalErrorEncountered) {
  console.error('FAILED:', progress.errors);
  process.exit(1);
}

console.log('DONE. Real output file:', progress.outputFile);
