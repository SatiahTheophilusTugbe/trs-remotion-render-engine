import { layoutBeats } from './layout';
import { parseWordTimings } from './captions';

export const MUSIC_VOLUME = 0.045;

export const musicVolume = (
  frame: number,
  totalFrames: number,
  fps: number,
  peak = MUSIC_VOLUME,
  fadeSeconds = 1,
): number => {
  const fade = Math.max(1, Math.round(fps * fadeSeconds));
  const fadeIn = Math.min(1, frame / fade);
  const fadeOut = Math.min(1, (totalFrames - frame) / fade);
  return Math.max(0, peak * Math.min(fadeIn, fadeOut));
};

// ── Music never competes with the narration (owner, 2026-10-03) ──
// Narration (HeyGen + ElevenLabs) measures about -18 LUFS. Each track is scaled so its LOUDEST
// 3-second moment sits at MUSIC_PEAK_UNDER_SPEECH_LUFS while someone is talking: 19.5 LU under the
// voice, the level of the approved Fever video (track 04 at 0.045). In pauses the bed lifts by
// GAP_LIFT so it still carries the edit.
export const MUSIC_PEAK_UNDER_SPEECH_LUFS = -37.5;
export const GAP_LIFT = 1.78; // +5 dB

// Max short-term loudness (LUFS, 3 s window) over each track's first 90 s, measured with
// ffmpeg ebur128 on 2026-10-03. Tracks not listed get UNKNOWN_TRACK_PEAK_LUFS, louder than any
// measured track, so a new upload can only come out quieter than target, never louder.
export const TRACK_PEAK_LUFS: Record<string, number> = {
  'trs_track_01.mp3': -8.3,
  'trs_track_02.mp3': -12.2,
  'trs_track_03.mp3': -8.5,
  'trs_track_04.mp3': -10.4,
  'trs_track_05.mp3': -10.2,
  'trs_track_06.mp3': -9.0,
  'trs_track_07.mp3': -10.5,
  'trs_track_08.mp3': -13.2,
  'trs_track_09.mp3': -11.6,
};
export const UNKNOWN_TRACK_PEAK_LUFS = -7.5;

export const trackGain = (url: string): number => {
  const name = String(url).split('?')[0].split('/').pop() ?? '';
  const peak = TRACK_PEAK_LUFS[name] ?? UNKNOWN_TRACK_PEAK_LUFS;
  return Math.pow(10, (MUSIC_PEAK_UNDER_SPEECH_LUFS - peak) / 20);
};

export type SpeechRange = { start: number; end: number }; // seconds on the video timeline

// Pauses shorter than this stay ducked (no pumping between sentences).
export const MIN_LIFT_GAP_SECONDS = 0.6;

export const speechRanges = (
  beats: { duration_sec: number; word_timings?: unknown }[],
  fps: number,
): SpeechRange[] => {
  const slots = layoutBeats(beats, fps);
  const raw: SpeechRange[] = [];
  beats.forEach((beat, i) => {
    const from = slots[i].from / fps;
    const words = parseWordTimings(beat.word_timings);
    if (words.length === 0) {
      // No timings: treat the whole beat as speech (stays ducked, the safe side).
      raw.push({ start: from, end: from + slots[i].durationInFrames / fps });
      return;
    }
    for (const w of words) raw.push({ start: from + w.start, end: from + w.end });
  });
  raw.sort((a, b) => a.start - b.start);
  const merged: SpeechRange[] = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (last && r.start - last.end < MIN_LIFT_GAP_SECONDS) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
};

export const DUCK_ATTACK_SECONDS = 0.25; // music is fully down by the time a word starts
export const DUCK_RELEASE_SECONDS = 0.5; // and eases back up after speech ends

// 1 while anyone is talking, rising smoothly to GAP_LIFT in real pauses.
export const duckFactor = (t: number, ranges: SpeechRange[]): number => {
  let s = 0;
  for (const r of ranges) {
    let v: number;
    if (t >= r.start && t <= r.end) v = 1;
    else if (t < r.start) v = 1 - (r.start - t) / DUCK_ATTACK_SECONDS;
    else v = 1 - (t - r.end) / DUCK_RELEASE_SECONDS;
    if (v > s) s = v;
    if (s >= 1) break;
  }
  s = Math.max(0, Math.min(1, s));
  return GAP_LIFT - (GAP_LIFT - 1) * s;
};

export const musicLevel = (
  frame: number,
  totalFrames: number,
  fps: number,
  gain: number,
  ranges: SpeechRange[] | null,
): number => {
  const base = musicVolume(frame, totalFrames, fps, gain);
  return ranges ? base * duckFactor(frame / fps, ranges) : base;
};
