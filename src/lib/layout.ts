import { framesForBeat } from './duration';

export type BeatSlot = { from: number; durationInFrames: number };

export const layoutBeats = (beats: { duration_sec: number }[], fps: number): BeatSlot[] => {
  let cursor = 0;
  return beats.map((beat) => {
    const durationInFrames = framesForBeat(beat, fps);
    const slot = { from: cursor, durationInFrames };
    cursor += durationInFrames;
    return slot;
  });
};

export const totalFrames = (slots: BeatSlot[]): number =>
  slots.length === 0 ? 0 : slots[slots.length - 1].from + slots[slots.length - 1].durationInFrames;
