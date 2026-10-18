export type WordTiming = { word: string; start: number; end: number };

export type StatData = {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
};

// Image-relative subject centre (x, y) and optional subject box size (w, h), all 0-1, from upstream
// Claude Vision. The renderer only crops when a box is present AND the photo's pixel size is known.
export type Focal = { x: number; y: number; w?: number; h?: number };

// One image shown during a beat, from at_sec (beat-relative) until the next visual or the beat end.
// 'split' shows two subjects side by side (url | url_b). photo_w/h are set by rehost, never by callers.
export type Visual = {
  url: string;
  at_sec: number;
  layout: 'single' | 'split';
  focal?: Focal | null;
  photo_w?: number;
  photo_h?: number;
  credit?: string | null;
  url_b?: string;
  focal_b?: Focal | null;
  photo_w_b?: number;
  photo_h_b?: number;
  credit_b?: string | null;
};

type BeatBase = {
  photo_url: string | null;
  audio_url?: string | null;
  overlay_text?: string | null;
  narration_line: string;
  duration_sec: number;
  // Stored upstream as a JSON *string*; accepted here as a string or an already-parsed array.
  word_timings?: string | WordTiming[] | null;
  beat_index: number;
  focal?: Focal | null;
  // Pixel size of the photo, measured by rehost from the real bytes (never caller-supplied).
  photo_w?: number;
  photo_h?: number;
  // Source credit for the photo (e.g. "Getty Images via Bleacher Report"), shown small on screen
  // while the photo is up. Absent/empty for the owner's own uploads.
  photo_credit?: string | null;
  // Named-subject visuals (2026-10-17). When present, the beat shows these in turn instead of photo_url.
  visuals?: Visual[];
};

export type AvatarBeatData = BeatBase & { type: 'avatar'; clip_url: string };
export type BrollBeatData = BeatBase & { type: 'broll'; clip_url?: string | null };
export type StatBeatData = BeatBase & { type: 'stat'; stat: StatData };

export type Beat = AvatarBeatData | BrollBeatData | StatBeatData;
