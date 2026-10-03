import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { Beat } from '../types/beat';
import { AvatarBeat } from './AvatarBeat';
import { BrollBeat } from './BrollBeat';
import { StatRevealBeat } from './StatRevealBeat';
import { layoutBeats } from '../lib/layout';
import type { ShotMotionOptions } from './useShotFrame';
import { parseWordTimings } from '../lib/captions';
import { GlassBanner } from './GlassBanner';
import { BrandBadges } from './BrandBadges';
import { MusicBed } from './MusicBed';
import { CaptionLayer, CAPTIONS_ON_AVATAR } from './CaptionLayer';
import { TransitionLayer } from './TransitionLayer';
import { cutStyleFor, wipeCutFrames } from '../lib/cuts';
import { SlideShakeCut } from './SlideShakeCut';

const renderBeat = (beat: Beat, fps: number, motion: ShotMotionOptions) => {
  switch (beat.type) {
    case 'avatar':
      return <AvatarBeat beat={beat} motion={motion} />;
    case 'broll':
      return <BrollBeat beat={beat} fps={fps} motion={motion} />;
    case 'stat':
      return <StatRevealBeat beat={beat} motion={motion} />;
    default: {
      const unreachable: never = beat;
      throw new Error(`Unknown beat type: ${String((unreachable as { type?: string }).type)}`);
    }
  }
};

export const BeatSequence: React.FC<{
  beats: Beat[];
  fps: number; // read by calculateMetadata only; layout uses useVideoConfig().fps
  leagueBadge?: string | null;
  musicUrl?: string | null;
  transitions?: boolean;
}> = ({ beats, leagueBadge, musicUrl, transitions }) => {
  const { fps } = useVideoConfig();
  const slots = layoutBeats(beats, fps);
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {beats.map((beat, index) => {
        const { from, durationInFrames } = slots[index];
        // Slide-shake cuts move the whole frame themselves: no slam into them, no whisk out of
        // them, and the final beat never whisks into black.
        const cutsOn = transitions !== false;
        const motion: ShotMotionOptions = {
          seed: index,
          slamIn: !(cutsOn && cutStyleFor(beats, index) === 'slideShake'),
          whiskOut: index < beats.length - 1 && !(cutsOn && cutStyleFor(beats, index + 1) === 'slideShake'),
        };
        return (
          <Sequence
            key={`${index}-${beat.beat_index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            {(() => {
              const content = (
                <>
                  {renderBeat(beat, fps, motion)}
                  {beat.type === 'broll' && beat.overlay_text ? <GlassBanner text={beat.overlay_text} /> : null}
                  {(() => {
                    const words = parseWordTimings(beat.word_timings);
                    const show = words.length > 0 && (beat.type !== 'avatar' || CAPTIONS_ON_AVATAR);
                    return show ? <CaptionLayer words={words} variant={beat.type === 'avatar' ? 'avatar' : 'broll'} /> : null;
                  })()}
                </>
              );
              const slideIn = transitions !== false && cutStyleFor(beats, index) === 'slideShake';
              const slideOut = transitions !== false && cutStyleFor(beats, index + 1) === 'slideShake';
              return slideIn || slideOut ? (
                <SlideShakeCut slideIn={slideIn} slideOut={slideOut}>
                  {content}
                </SlideShakeCut>
              ) : (
                content
              );
            })()}
          </Sequence>
        );
      })}
      {transitions !== false ? <TransitionLayer cuts={wipeCutFrames(beats, slots)} /> : null}
      <BrandBadges leagueBadge={leagueBadge} />
      {musicUrl ? <MusicBed src={musicUrl} /> : null}
    </AbsoluteFill>
  );
};
