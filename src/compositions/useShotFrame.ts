import { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Focal } from '../types/beat';
import { framesForBeat } from '../lib/duration';
import { focalObjectPosition, photoLayout, planShots, smallPhotoSize, type PhotoLayout } from '../lib/shots';
import { shotFrameAt, type ShotFrame } from '../lib/shotMotion';

export type ShotMotionOptions = { seed: number; slamIn: boolean; whiskOut: boolean };
// Used when a beat component is rendered outside BeatSequence (src/bakeoff/ tooling).
export const DEFAULT_SHOT_MOTION: ShotMotionOptions = { seed: 0, slamIn: true, whiskOut: false };

export const useShotFrame = (
  beat: { duration_sec: number; focal?: Focal | null; photo_w?: number; photo_h?: number },
  motion: ShotMotionOptions = DEFAULT_SHOT_MOTION,
): { shot: ShotFrame; objectPosition: string; layout: PhotoLayout; smallSize: { width: number; height: number } | null } => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = framesForBeat(beat, fps);
  const { seed, slamIn, whiskOut } = motion;
  const focal = beat.focal ?? null;
  const aspect = beat.photo_w && beat.photo_h ? beat.photo_w / beat.photo_h : null;
  const shots = useMemo(
    () => planShots(durationInFrames, fps, { focal, aspect, seed, slamIn, whiskOut }),
    [durationInFrames, fps, focal, aspect, seed, slamIn, whiskOut],
  );
  const layout = photoLayout(focal, aspect, beat.photo_w, beat.photo_h);
  const smallSize = layout === 'small' && beat.photo_w && beat.photo_h ? smallPhotoSize(beat.photo_w, beat.photo_h) : null;
  return { shot: shotFrameAt(shots, frame, focal), objectPosition: focalObjectPosition(focal), layout, smallSize };
};
