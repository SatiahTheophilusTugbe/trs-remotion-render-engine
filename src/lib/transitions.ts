import type { BeatSlot } from './layout';

export const WIPE_HALF_FRAMES = 5;
export const WIPE_WIDTH = 1700;
export const WIPE_SKEW_MARGIN = 210;

export const cutFrames = (slots: BeatSlot[]): number[] => slots.slice(1).map((slot) => slot.from);

export const wipeOffsetPx = (frame: number, cut: number): number | null => {
  const k = frame - (cut - WIPE_HALF_FRAMES);
  if (k < 0 || k >= 2 * WIPE_HALF_FRAMES) return null;
  return -310 + 400 * (k - WIPE_HALF_FRAMES);
};
