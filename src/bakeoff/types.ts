// Filled at render time from the gitignored out/proof-media.json via make-props.mjs (--props).
// No media URL ever lives in source.
export type BakeoffMedia = {
  avatarPhoto: string | null;
  avatarClipStandin: string | null;
  brollPhoto: string | null;
  brollAudio: string | null;
  music: string | null;
};

export type StoryBeat = {
  beat_index: number;
  type: string;
  narration_line: string;
  overlay_text: string;
  duration_sec: number;
  word_timings: string;
};

export type BakeoffProps = {
  media: BakeoffMedia;
  story: StoryBeat[];
};

export const emptyMedia: BakeoffMedia = {
  avatarPhoto: null,
  avatarClipStandin: null,
  brollPhoto: null,
  brollAudio: null,
  music: null,
};

export const defaultBakeoffProps: BakeoffProps = { media: emptyMedia, story: [] };

export const FPS = 30;
