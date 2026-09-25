import type { ReactNode } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import type { Beat } from '../types/beat';
import { AvatarBeat } from '../compositions/AvatarBeat';
import { BrollBeat } from '../compositions/BrollBeat';
import { StatRevealBeat } from '../compositions/StatRevealBeat';
import { OverlayBanner } from '../compositions/OverlayBanner';
import { CaptionLayer, CAPTIONS_ON_AVATAR } from '../compositions/CaptionLayer';
import { BrandBadges } from '../compositions/BrandBadges';
import { MusicBed } from '../compositions/MusicBed';
import { parseWordTimings } from '../lib/captions';
import { montserratBold } from '../lib/fonts';
import { FPS } from './types';
import type { BakeoffProps } from './types';

export const LIME = '#CCFF00';
export const DARK = '#0a0a0a';

// Mirrors the per-beat content of production BeatSequence (renderBeat + banner + captions),
// minus the transition layer / badges / music so bake-off variants can wrap it.
export const BeatContent: React.FC<{ beat: Beat; banner?: boolean }> = ({ beat, banner = true }) => {
  const words = parseWordTimings(beat.word_timings);
  const showCaptions = words.length > 0 && (beat.type !== 'avatar' || CAPTIONS_ON_AVATAR);
  return (
    <AbsoluteFill>
      {beat.type === 'avatar' ? <AvatarBeat beat={beat} /> : null}
      {beat.type === 'broll' ? <BrollBeat beat={beat} fps={FPS} /> : null}
      {beat.type === 'stat' ? <StatRevealBeat beat={beat} /> : null}
      {banner && beat.type === 'broll' && beat.overlay_text ? <OverlayBanner text={beat.overlay_text} /> : null}
      {showCaptions ? <CaptionLayer words={words} variant={beat.type === 'avatar' ? 'avatar' : 'broll'} /> : null}
    </AbsoluteFill>
  );
};

export const LabelChip: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: 'absolute',
      left: 24,
      bottom: 44,
      padding: '8px 16px',
      background: '#FF2BD6',
      color: '#fff',
      borderRadius: 8,
      fontFamily: montserratBold,
      fontSize: 26,
      fontWeight: 700,
      whiteSpace: 'nowrap',
      border: '2px solid #fff',
    }}
  >
    {`BAKEOFF ${text}`}
  </div>
);

export type Segment = { frames: number; label: string; node: ReactNode };

export const totalSegmentFrames = (segs: { frames: number }[]): number =>
  segs.reduce((s, x) => s + x.frames, 0);

// Sequential labelled segments + shared brand badges + music bed.
export const SegmentRunner: React.FC<{
  segments: Segment[];
  musicUrl: string | null;
  leagueBadge?: string;
}> = ({ segments, musicUrl, leagueBadge = 'NBA' }) => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      {segments.map((seg) => {
        const from = cursor;
        cursor += seg.frames;
        return (
          <Sequence key={seg.label} from={from} durationInFrames={seg.frames}>
            <AbsoluteFill style={{ backgroundColor: DARK }}>{seg.node}</AbsoluteFill>
            <BrandBadges leagueBadge={leagueBadge} />
            <LabelChip text={seg.label} />
          </Sequence>
        );
      })}
      {musicUrl ? <MusicBed src={musicUrl} /> : null}
    </AbsoluteFill>
  );
};

export const storyBeat = (props: BakeoffProps, type: string) =>
  props.story.find((b) => b.type === type) ?? props.story[0];

export const SAMPLE_STAT = { value: 27.4, label: 'Points per game', decimals: 1 };

// 4-beat sample story: broll -> avatar(stand-in clip) -> stat -> broll
export const BEAT_SECONDS = 3.2;
export const buildSampleBeats = (props: BakeoffProps): Beat[] => {
  const { media } = props;
  const broll = storyBeat(props, 'broll');
  const avatar = storyBeat(props, 'avatar');
  const wt = (b?: { word_timings: string }) => b?.word_timings ?? null;
  return [
    {
      type: 'broll',
      photo_url: media.brollPhoto,
      audio_url: media.brollAudio,
      overlay_text: broll?.overlay_text ?? 'Sample headline',
      narration_line: '',
      duration_sec: BEAT_SECONDS,
      word_timings: wt(broll),
      beat_index: 0,
    },
    {
      type: 'avatar',
      photo_url: media.avatarPhoto,
      clip_url: media.avatarClipStandin ?? '',
      overlay_text: '',
      narration_line: '',
      duration_sec: BEAT_SECONDS,
      word_timings: wt(avatar),
      beat_index: 1,
    },
    {
      type: 'stat',
      photo_url: media.brollPhoto,
      overlay_text: '',
      narration_line: '',
      duration_sec: BEAT_SECONDS,
      stat: SAMPLE_STAT,
      beat_index: 2,
    },
    {
      type: 'broll',
      photo_url: media.avatarPhoto,
      audio_url: media.brollAudio,
      overlay_text: broll?.overlay_text ?? 'Sample headline',
      narration_line: '',
      duration_sec: BEAT_SECONDS,
      word_timings: wt(broll),
      beat_index: 3,
    },
  ];
};
