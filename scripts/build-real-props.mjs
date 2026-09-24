// usage: node scripts/build-real-props.mjs > out/real-props.json
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../src/fixtures/real-story-ballmer.json', import.meta.url)));
const avatar = fixture.find((b) => b.type === 'avatar');
const broll = fixture.find((b) => b.type === 'broll');

// Media URLs live in the GITIGNORED out/proof-media.json (provided by the controller) — never commit URLs taken from production rows.
// Keys: avatarPhoto, avatarClipStandin (a STAND-IN: real HeyGen signed URLs have expired), brollPhoto, brollAudio (the REAL ElevenLabs narration that broll.word_timings was aligned to), music.
let media;
try {
  media = JSON.parse(readFileSync(new URL('../out/proof-media.json', import.meta.url)));
} catch {
  console.error('Missing out/proof-media.json (gitignored). Expected keys: avatarPhoto, avatarClipStandin, brollPhoto, brollAudio, music');
  process.exit(1);
}

const props = {
  fps: 30,
  leagueBadge: 'NBA',
  musicUrl: process.argv.includes('--music') ? media.music : undefined,
  beats: [
    { ...broll, beat_index: 0, photo_url: media.brollPhoto, audio_url: media.brollAudio, clip_url: '' },
    { ...avatar, beat_index: 1, photo_url: media.avatarPhoto, clip_url: media.avatarClipStandin },
  ],
};
process.stdout.write(JSON.stringify(props, null, 2));
