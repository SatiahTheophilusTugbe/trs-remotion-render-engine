import { Sequence, useVideoConfig } from 'remotion';
import type { Visual } from '../types/beat';
import { visualSegments, type VisualSegment } from '../lib/visuals';
import { useShotFrame, type ShotMotionOptions } from './useShotFrame';
import { BeatBackground } from './BeatBackground';
import { SplitCard } from './SplitCard';
import { PhotoCredit } from './PhotoCredit';

// A beat's images in turn (named-subject visuals, 2026-10-17). The beat-level slam / sweep in and whisk /
// sweep out stay on the beat's first and last image; every boundary between images is a random inner cut.
const Segment: React.FC<{ seg: VisualSegment; motion: ShotMotionOptions; first: boolean; last: boolean; fps: number }> = ({
  seg, motion, first, last, fps,
}) => {
  const v = seg.visual;
  const split = v.layout === 'split' && !!v.url_b;
  const segMotion: ShotMotionOptions = {
    seed: motion.seed * 17 + seg.from,
    slamIn: first && motion.slamIn,
    sweepIn: first && !!motion.sweepIn,
    whiskOut: last && motion.whiskOut,
    sweepOut: last && !!motion.sweepOut,
    entryCut: seg.entryCut,
    exitCut: seg.exitCut,
  };
  // A split card never crops: plan its motion without a subject box.
  const beatLike = split
    ? { duration_sec: seg.durationInFrames / fps }
    : { duration_sec: seg.durationInFrames / fps, focal: v.focal, photo_w: v.photo_w, photo_h: v.photo_h };
  const { shot, objectPosition, layout, smallSize } = useShotFrame(beatLike, segMotion);
  return split ? (
    <SplitCard urlA={v.url} urlB={v.url_b!} focalA={v.focal} focalB={v.focal_b} shot={shot} />
  ) : (
    <BeatBackground photoUrl={v.url} objectPosition={objectPosition} shot={shot} layout={layout} smallSize={smallSize} />
  );
};

const creditOf = (v: Visual): string | null => {
  const parts = [v.credit, v.layout === 'split' ? v.credit_b : null].filter((c): c is string => !!c);
  return parts.length ? [...new Set(parts)].join(' · ') : null;
};

export const VisualTrack: React.FC<{
  visuals: Visual[];
  durationInFrames: number;
  motion: ShotMotionOptions;
  variant: 'avatar' | 'broll';
}> = ({ visuals, durationInFrames, motion, variant }) => {
  const { fps } = useVideoConfig();
  const segs = visualSegments(visuals, durationInFrames, fps, motion.seed);
  return (
    <>
      {segs.map((seg, k) => {
        const credit = creditOf(seg.visual);
        return (
          <Sequence key={k} from={seg.from} durationInFrames={seg.durationInFrames} layout="none">
            <Segment seg={seg} motion={motion} first={k === 0} last={k === segs.length - 1} fps={fps} />
            {credit ? <PhotoCredit credit={credit} variant={variant} durationInFrames={seg.durationInFrames} /> : null}
          </Sequence>
        );
      })}
    </>
  );
};
