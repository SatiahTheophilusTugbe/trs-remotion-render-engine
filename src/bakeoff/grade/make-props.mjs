/* global console, process */
// Builds out/grade-props.json (gitignored) pointing at the localhost media server, plus the real
// story fixture. Never prints media URLs. Usage: node src/bakeoff/grade/make-props.mjs
// Prereq: node src/bakeoff/grade/fetch-media.mjs (fills out/media), then serve-media.mjs running.
import { readFileSync, writeFileSync } from 'node:fs';

const port = process.env.GRADE_MEDIA_PORT ?? '8765';
const names = JSON.parse(readFileSync('out/media/names.json', 'utf8'));
const local = (key) => (names[key] ? `http://127.0.0.1:${port}/${names[key]}` : null);
const story = JSON.parse(readFileSync('src/fixtures/real-story-ballmer.json', 'utf8'));
const base = {
  media: {
    avatarPhoto: local('avatarPhoto'),
    avatarClipStandin: local('avatarClipStandin'),
    brollPhoto: local('brollPhoto'),
    music: local('music'),
    arenaPhoto: local('avatarPhotoCdnNba'),
  },
  story,
  gradeId: 'G0',
  disable: [],
};
writeFileSync('out/grade-props.json', JSON.stringify(base));
console.log('wrote out/grade-props.json');
