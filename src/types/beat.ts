export type Beat = {
  type: 'avatar' | 'broll';
  photo_url: string;
  clip_url?: string;
  audio_url?: string;
  overlay_text: string;
  narration_line: string;
  duration_sec: number;
  word_timings?: unknown[];
  beat_index: number;
};
