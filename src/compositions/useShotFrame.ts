import { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Focal } from '../types/beat';
import { framesForBeat } from '../lib/duration';
import { photoLayout, planShots, smallPhotoSize, subjectFramePosition, withObjectX, type PhotoLayout } from '../lib/shots';
import { shotFrameAt, type ShotFrame } from '../lib/shotMotion';

export type ShotMotionOptions = { seed: number; slamIn: boolean; whiskOut: boolean; sweepIn?: boolean; sweepOut?: boolean };
// Used when a beat component is rendered outside BeatSequence (src/bakeoff/ tooling).
export const DEFAULT_SHOT_MOTION: ShotMotionOptions = { seed: 0, slamIn: true, whiskOut: false };

export const useShotFrame = (
  beat: { duration_sec: number; focal?: Focal | null; photo_w?: number; photo_h?: number },
  motion: ShotMotionOptions = DEFAULT_SHOT_MOTION,
): { shot: ShotFrame; objectPosition: string; layout: PhotoLayout; smallSize: { width: number; height: number } | null } => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = framesForBeat(beat, fps);
  const { seed, slamIn, whiskOut, sweepIn = false, sweepOut = false } = motion;
  const focal = beat.focal ?? null;
  const aspect = beat.photo_w && beat.photo_h ? beat.photo_w / beat.photo_h : null;
  const layout = photoLayout(focal, aspect, beat.photo_w, beat.photo_h);
  const shots = useMemo(
    () => planShots(durationInFrames, fps, { focal, aspect, layout, seed, slamIn, whiskOut, sweepIn, sweepOut }),
    [durationInFrames, fps, focal, aspect, layout, seed, slamIn, whiskOut, sweepIn, sweepOut],
  );
  const smallSize = layout === 'small' && beat.photo_w && beat.photo_h ? smallPhotoSize(beat.photo_w, beat.photo_h) : null;
  // Subject box centre in frame space (centred by the object-position); the shot motion centres on it.
  const subject = subjectFramePosition(focal, aspect);
  const shot = shotFrameAt(shots, frame, subject);
  const base = subject?.objectPosition ?? 'center top';
  // A group pan moves the horizontal object-position frame by frame (shots.ts groupPan).
  const objectPosition = shot.objectX === undefined ? base : withObjectX(base, shot.objectX);
  return { shot, objectPosition, layout, smallSize };
};
