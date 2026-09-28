/* global console, process */
// Render-cost measurement: renders the same 5s (150 frame) GradeTiming sample per config and reports
// wall seconds of renderMedia only (bundling excluded). Usage:
//   node src/bakeoff/grade/measure.mjs [concurrency=1] [reps=2]
// Writes out/grade-timing.json. Needs the media server running and out/grade-props.json.
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const concurrency = Number(process.argv[2] ?? 1);
const reps = Number(process.argv[3] ?? 2);
const base = JSON.parse(readFileSync('out/grade-props.json', 'utf8'));
const only = process.argv[4] ? new RegExp(process.argv[4]) : null;
const allConfigs = [
  { name: 'G0', gradeId: 'G0', disable: [] },
  { name: 'G1', gradeId: 'G1', disable: [] },
  { name: 'G1 filter only (no vignette)', gradeId: 'G1', disable: ['vignette'] },
  { name: 'G2', gradeId: 'G2', disable: [] },
  { name: 'G2 no bloom', gradeId: 'G2', disable: ['bloom'] },
  { name: 'G3', gradeId: 'G3', disable: [] },
  { name: 'G4', gradeId: 'G4', disable: [] },
  { name: 'G4 no grain', gradeId: 'G4', disable: ['grain'] },
];
const configs = allConfigs.filter((c, i) => i === 0 || !only || only.test(c.name));
mkdirSync('out/grade-timing', { recursive: true });
const serveUrl = await bundle({ entryPoint: 'src/bakeoff/grade/index.ts' });
const results = [];
// warm-up (browser start, font load, media cache) so the first config is not penalised
const warm = { ...base, gradeId: 'G0', disable: [] };
const comp0 = await selectComposition({ serveUrl, id: 'GradeTiming', inputProps: warm });
await renderMedia({ composition: comp0, serveUrl, codec: 'h264', outputLocation: 'out/grade-timing/warm.mp4', inputProps: warm, concurrency, imageFormat: 'jpeg', logLevel: 'error' });
for (const cfg of configs) {
  const inputProps = { ...base, gradeId: cfg.gradeId, disable: cfg.disable };
  const composition = await selectComposition({ serveUrl, id: 'GradeTiming', inputProps });
  const secs = [];
  for (let r = 0; r < reps; r++) {
    const t0 = Date.now();
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: 'out/grade-timing/t.mp4', inputProps, concurrency, imageFormat: 'jpeg', logLevel: 'error' });
    secs.push((Date.now() - t0) / 1000);
  }
  const best = Math.min(...secs);
  const mean = secs.reduce((a, b) => a + b, 0) / secs.length;
  results.push({ name: cfg.name, secs, best, mean, perFrame: mean / composition.durationInFrames });
  console.log(cfg.name, secs.map((s) => s.toFixed(1)).join(' '), 'mean s/frame', (mean / composition.durationInFrames).toFixed(4));
}
const g0 = results[0].mean;
for (const r of results) r.overheadPerFrame = (r.mean - g0) / 150;
writeFileSync(`out/grade-timing-c${concurrency}${only ? '-partial' : ''}.json`, JSON.stringify(results, null, 1));
for (const r of results) console.log(r.name.padEnd(32), r.perFrame.toFixed(4), 's/frame', 'overhead', r.overheadPerFrame.toFixed(4), 's/frame');
