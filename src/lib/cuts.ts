import type { BeatSlot } from './layout';

export type CutStyle = 'none' | 'wipe' | 'slideShake';

// Style of the cut INTO beat `index`. The first beat has no cut; an impact cut (slide + shake)
// is used when the incoming beat is a stat beat or the last beat; every other boundary keeps the
// default lime wipe.
export const cutStyleFor = (beats: { type: string }[], index: number): CutStyle => {
  if (index <= 0 || index >= beats.length) return 'none';
  if (beats[index].type === 'stat' || index === beats.length - 1) return 'slideShake';
  return 'wipe';
};

const framesWithStyle = (beats: { type: string }[], slots: BeatSlot[], style: CutStyle): number[] =>
  slots.filter((_, i) => cutStyleFor(beats, i) === style).map((slot) => slot.from);

export const impactCutFrames = (beats: { type: string }[], slots: BeatSlot[]): number[] =>
  framesWithStyle(beats, slots, 'slideShake');

export const wipeCutFrames = (beats: { type: string }[], slots: BeatSlot[]): number[] =>
  framesWithStyle(beats, slots, 'wipe');
