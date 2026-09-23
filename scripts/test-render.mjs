// scripts/test-render.mjs
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../deploy-manifest.json', import.meta.url)));

const testBeats = [
  { beat_index: 0, overlay_text: 'G1 real render proof', duration_sec: 2 },
  { beat_index: 1, overlay_text: 'Second beat', duration_sec: 2 },
];

const { renderId, bucketName } = await renderMediaOnLambda({
  region: manifest.region,
  functionName: manifest.functionName,
  serveUrl: manifest.serveUrl,
  composition: 'TrivialBeatDemo',
  codec: 'h264',
  inputProps: { beats: testBeats, fps: 30 },
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
