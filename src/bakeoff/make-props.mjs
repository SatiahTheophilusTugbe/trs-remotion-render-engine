// Builds out/bakeoff-props.json (gitignored) from out/proof-media.json + the real-story fixture.
// Never prints media URLs. Usage: node src/bakeoff/make-props.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const m = JSON.parse(readFileSync('out/proof-media.json', 'utf8'));
const story = JSON.parse(readFileSync('src/fixtures/real-story-ballmer.json', 'utf8'));
const props = {
  media: {
    avatarPhoto: m.avatarPhoto ?? null,
    avatarClipStandin: m.avatarClipStandin ?? null,
    brollPhoto: m.brollPhoto ?? null,
    brollAudio: m.brollAudio ?? null,
    music: m.music ?? null,
  },
  story,
};
writeFileSync('out/bakeoff-props.json', JSON.stringify(props));
