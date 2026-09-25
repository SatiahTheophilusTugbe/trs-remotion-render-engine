import { AbsoluteFill } from 'remotion';
import { OverlayBanner } from '../compositions/OverlayBanner';
import { BeatContent, SegmentRunner, storyBeat } from './shared';
import type { Segment } from './shared';
import { GlassLowerThird } from './GlassLowerThird';
import type { BakeoffProps } from './types';
import type { Beat } from '../types/beat';

export const BANNER_SEGMENT_FRAMES = 135; // 4.5s

const brollBeat = (props: BakeoffProps): Beat => {
  const b = storyBeat(props, 'broll');
  return {
    type: 'broll',
    photo_url: props.media.brollPhoto,
    audio_url: props.media.brollAudio,
    overlay_text: b?.overlay_text ?? 'Sample headline',
    narration_line: '',
    duration_sec: BANNER_SEGMENT_FRAMES / 30,
    word_timings: b?.word_timings ?? null,
    beat_index: 0,
  };
};

export const BakeoffBanner: React.FC<BakeoffProps> = (props) => {
  const beat = brollBeat(props);
  const text = beat.overlay_text ?? '';
  const segments: Segment[] = [
    {
      frames: BANNER_SEGMENT_FRAMES,
      label: 'B1 Current banner',
      node: (
        <AbsoluteFill>
          <BeatContent beat={beat} banner={false} />
          <OverlayBanner text={text} />
        </AbsoluteFill>
      ),
    },
    {
      frames: BANNER_SEGMENT_FRAMES,
      label: 'B2 Glass lower third',
      node: (
        <AbsoluteFill>
          <BeatContent beat={beat} banner={false} />
          <GlassLowerThird text={text} />
        </AbsoluteFill>
      ),
    },
  ];
  return <SegmentRunner segments={segments} musicUrl={props.media.music} />;
};
