export type WordTiming = { word: string; start: number; end: number };

export type StatData = {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
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
};

export type AvatarBeatData = BeatBase & { type: 'avatar'; clip_url: string };
export type BrollBeatData = BeatBase & { type: 'broll'; clip_url?: string | null };
export type StatBeatData = BeatBase & { type: 'stat'; stat: StatData };

export type Beat = AvatarBeatData | BrollBeatData | StatBeatData;
