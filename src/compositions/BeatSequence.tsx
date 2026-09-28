import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { Beat } from '../types/beat';
import { AvatarBeat } from './AvatarBeat';
import { BrollBeat } from './BrollBeat';
import { StatRevealBeat } from './StatRevealBeat';
import { layoutBeats } from '../lib/layout';
import { assignCameraMoves, type CameraMoveName } from '../lib/camera';
import { parseWordTimings } from '../lib/captions';
import { GlassBanner } from './GlassBanner';
import { BrandBadges } from './BrandBadges';
import { MusicBed } from './MusicBed';
import { CaptionLayer, CAPTIONS_ON_AVATAR } from './CaptionLayer';
import { TransitionLayer } from './TransitionLayer';
import { cutStyleFor, wipeCutFrames } from '../lib/cuts';
import { SlideShakeCut } from './SlideShakeCut';

const renderBeat = (beat: Beat, fps: number, cameraMove: CameraMoveName) => {
  switch (beat.type) {
    case 'avatar':
      return <AvatarBeat beat={beat} cameraMove={cameraMove} />;
    case 'broll':
      return <BrollBeat beat={beat} fps={fps} cameraMove={cameraMove} />;
    case 'stat':
      return <StatRevealBeat beat={beat} cameraMove={cameraMove} />;
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
  const cameraMoves = assignCameraMoves(beats);
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {beats.map((beat, index) => {
        const { from, durationInFrames } = slots[index];
        return (
          <Sequence
            key={`${index}-${beat.beat_index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            {(() => {
              const content = (
                <>
                  {renderBeat(beat, fps, cameraMoves[index])}
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
