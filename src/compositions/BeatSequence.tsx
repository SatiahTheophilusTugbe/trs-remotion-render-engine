import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { Beat } from '../types/beat';
import { AvatarBeat } from './AvatarBeat';
import { BrollBeat } from './BrollBeat';
import { layoutBeats } from '../lib/layout';
import { parseWordTimings } from '../lib/captions';
import { OverlayBanner } from './OverlayBanner';
import { BrandBadges } from './BrandBadges';
import { MusicBed } from './MusicBed';
import { CaptionLayer, CAPTIONS_ON_AVATAR } from './CaptionLayer';

const renderBeat = (beat: Beat, fps: number) => {
  switch (beat.type) {
    case 'avatar':
      return <AvatarBeat beat={beat} />;
    case 'broll':
      return <BrollBeat beat={beat} fps={fps} />;
    case 'stat':
      throw new Error('stat beats not implemented yet');
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
}> = ({ beats, leagueBadge, musicUrl }) => {
  const { fps } = useVideoConfig();
  const slots = layoutBeats(beats, fps);
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
            {renderBeat(beat, fps)}
            {beat.type === 'broll' && beat.overlay_text ? <OverlayBanner text={beat.overlay_text} /> : null}
            {(() => {
              if (beat.type === 'stat') return null; // stat captions: decided in Task 2
              const words = parseWordTimings(beat.word_timings);
              const show = words.length > 0 && (beat.type === 'broll' || CAPTIONS_ON_AVATAR);
              return show ? <CaptionLayer words={words} variant={beat.type} /> : null;
            })()}
          </Sequence>
        );
      })}
      <BrandBadges leagueBadge={leagueBadge} />
      {musicUrl ? <MusicBed src={musicUrl} /> : null}
    </AbsoluteFill>
  );
};
