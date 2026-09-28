/* global console, process */
// Builds out/grade-single-<GRADE>.json (gitignored) for one grade's individual render, pointing at
// the localhost media server, plus the real story fixture. Never prints media URLs.
// Usage: node src/bakeoff/grade/make-single-props.mjs <G1|G2|G3|G4>
// Prereq: node src/bakeoff/grade/fetch-media.mjs (fills out/media), then serve-media.mjs running.
import { readFileSync, writeFileSync } from 'node:fs';

const gradeId = process.argv[2];
if (!gradeId || !/^G[1-4]$/.test(gradeId)) {
  console.error('usage: node src/bakeoff/grade/make-single-props.mjs <G1|G2|G3|G4>');
  process.exit(1);
}

const port = process.env.GRADE_MEDIA_PORT ?? '8765';
const names = JSON.parse(readFileSync('out/media/names.json', 'utf8'));
const local = (key) => (names[key] ? `http://127.0.0.1:${port}/${names[key]}` : null);
const story = JSON.parse(readFileSync('src/fixtures/real-story-ballmer.json', 'utf8'));
const props = {
  media: {
    avatarPhoto: local('avatarPhoto'),
    avatarClipStandin: local('avatarClipStandin'),
    brollPhoto: local('brollPhoto'),
    music: local('music'),
    arenaPhoto: local('avatarPhotoCdnNba'),
  },
  story,
  gradeId,
  disable: [],
};
const out = `out/grade-single-${gradeId}.json`;
writeFileSync(out, JSON.stringify(props));
console.log('wrote', out);
