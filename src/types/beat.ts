export type WordTiming = { word: string; start: number; end: number };

export type Beat = {
  type: 'avatar' | 'broll';
  photo_url: string | null;
  clip_url?: string | null;
  audio_url?: string | null;
  overlay_text?: string | null;
  narration_line: string;
  duration_sec: number;
  // Stored upstream as a JSON *string*; accepted here as a string or an already-parsed array.
  word_timings?: string | WordTiming[] | null;
  beat_index: number;
};
