// Graded mirrors of the production beat components (PROTOTYPE). They reuse every production
// overlay component unchanged (CaptionLayer, GlassBanner, BrandBadges, TransitionLayer,
// SlideShakeCut, OdometerStat) and only re-implement the small photographic layers so that
// <ColorGrade> can wrap exactly the photo background and the avatar clip video.
import { createContext, useContext } from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Beat } from '../../types/beat';
import { BeatBackground } from '../../compositions/BeatBackground';
import { OdometerStat } from '../../compositions/OdometerStat';
import { GlassBanner } from '../../compositions/GlassBanner';
import { CaptionLayer, CAPTIONS_ON_AVATAR } from '../../compositions/CaptionLayer';
import { BrandBadges } from '../../compositions/BrandBadges';
import { TransitionLayer } from '../../compositions/TransitionLayer';
import { SlideShakeCut } from '../../compositions/SlideShakeCut';
import { kenBurnsScale } from '../../lib/kenburns';
import { framesForBeat } from '../../lib/duration';
import { layoutBeats } from '../../lib/layout';
import { parseWordTimings } from '../../lib/captions';
import { cutStyleFor, wipeCutFrames } from '../../lib/cuts';
import { ColorGrade } from './ColorGrade';
import { G0 } from './grades';
import type { Grade } from './grades';
import type { GradeDisable } from './types';

const GradeContext = createContext<Grade>(G0);
export const GradeProvider = GradeContext.Provider;
export const useGrade = (): Grade => useContext(GradeContext);

export const withDisabled = (g: Grade, disable: GradeDisable[]): Grade => ({
  ...g,
  bloom: disable.indexOf('bloom') >= 0 ? { ...g.bloom, intensity: 0 } : g.bloom,
  grain: disable.indexOf('grain') >= 0 ? 0 : g.grain,
  vignette: disable.indexOf('vignette') >= 0 ? { ...g.vignette, strength: 0 } : g.vignette,
  wash: disable.indexOf('wash') >= 0 ? { ...g.wash, opacity: 0 } : g.wash,
});

/** Optional synthetic exposure shift (CSS brightness) applied BEFORE the grade, for stress frames. */
export const GradedPhoto: React.FC<{
  photoUrl: string | null | undefined;
  scale?: number;
  exposure?: number;
}> = ({ photoUrl, scale = 1, exposure = 1 }) => {
  const grade = useGrade();
  return (
    <ColorGrade grade={grade} layers="all">
      <AbsoluteFill style={{ filter: exposure === 1 ? undefined : `brightness(${exposure})` }}>
        <BeatBackground photoUrl={photoUrl} objectPosition="center top" scale={scale} />
      </AbsoluteFill>
    </ColorGrade>
  );
};

export const AVATAR_BOX = { width: 320, height: 569 } as const;

// Same box geometry/border/mask as production AvatarBeat. The lime border and mask live on the
// container (outside the graded child), so the border colour is never graded.
export const GradedAvatarBox: React.FC<{ clipUrl: string }> = ({ clipUrl }) => {
  const grade = useGrade();
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: AVATAR_BOX.width,
        height: AVATAR_BOX.height,
        border: '2px solid #CCFF00',
        borderRadius: '12px 0 0 0',
        overflow: 'hidden',
        WebkitMaskImage: 'linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.35) 8%, #000 22%, #000 100%)',
        maskImage: 'linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.35) 8%, #000 22%, #000 100%)',
      }}
    >
      <ColorGrade grade={grade} width={AVATAR_BOX.width} layers="tone">
        <OffthreadVideo src={clipUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </ColorGrade>
    </div>
  );
};

const GradedBeat: React.FC<{ beat: Beat; fps: number }> = ({ beat, fps }) => {
  const frame = useCurrentFrame();
  const dur = framesForBeat(beat, fps);
  const kb = kenBurnsScale(frame, dur);
  switch (beat.type) {
    case 'avatar':
      return (
        <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
          <GradedPhoto photoUrl={beat.photo_url} />
          <GradedAvatarBox clipUrl={beat.clip_url} />
        </AbsoluteFill>
      );
    case 'broll':
      return (
        <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
          <GradedPhoto photoUrl={beat.photo_url} scale={kb} />
        </AbsoluteFill>
      );
    case 'stat':
      return (
        <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
          <GradedPhoto photoUrl={beat.photo_url} scale={kb} />
          <OdometerStat stat={beat.stat} />
        </AbsoluteFill>
      );
    default: {
      const unreachable: never = beat;
      throw new Error(`Unknown beat type: ${String((unreachable as { type?: string }).type)}`);
    }
  }
};

// Mirrors production BeatSequence (same beat overlays, wipe / slide-push cuts, badges) with the
// photographic layers graded via context. No music here (added by the caller).
export const GradedBeatSequence: React.FC<{ beats: Beat[]; leagueBadge?: string | null }> = ({
  beats,
  leagueBadge,
}) => {
  const { fps } = useVideoConfig();
  const slots = layoutBeats(beats, fps);
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {beats.map((beat, index) => {
        const { from, durationInFrames } = slots[index];
        const words = parseWordTimings(beat.word_timings);
        const showCaptions = words.length > 0 && (beat.type !== 'avatar' || CAPTIONS_ON_AVATAR);
        const content = (
          <>
            <GradedBeat beat={beat} fps={fps} />
            {beat.type === 'broll' && beat.overlay_text ? <GlassBanner text={beat.overlay_text} /> : null}
            {showCaptions ? (
              <CaptionLayer words={words} variant={beat.type === 'avatar' ? 'avatar' : 'broll'} />
            ) : null}
          </>
        );
        const slideIn = cutStyleFor(beats, index) === 'slideShake';
        const slideOut = cutStyleFor(beats, index + 1) === 'slideShake';
        return (
          <Sequence key={`${index}-${beat.beat_index}`} from={from} durationInFrames={durationInFrames}>
            {slideIn || slideOut ? (
              <SlideShakeCut slideIn={slideIn} slideOut={slideOut}>
                {content}
              </SlideShakeCut>
            ) : (
              content
            )}
          </Sequence>
        );
      })}
      <TransitionLayer cuts={wipeCutFrames(beats, slots)} />
      <BrandBadges leagueBadge={leagueBadge} />
    </AbsoluteFill>
  );
};
