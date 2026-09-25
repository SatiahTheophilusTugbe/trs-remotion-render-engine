import { AbsoluteFill } from 'remotion';
import { BrollBeat } from '../compositions/BrollBeat';
import { StatRevealBeat } from '../compositions/StatRevealBeat';
import type { StatBeatData } from '../types/beat';
import { SegmentRunner, SAMPLE_STAT } from './shared';
import type { Segment } from './shared';
import { KpiStat } from './KpiStat';
import { ParallaxPhoto } from './ParallaxPhoto';
import type { BakeoffProps } from './types';
import { FPS } from './types';

export const STAT_SEGMENT_FRAMES = 120; // 4s
export const PHOTO_SEGMENT_FRAMES = 150; // 5s

export const BakeoffStat: React.FC<BakeoffProps> = (props) => {
  const beat: StatBeatData = {
    type: 'stat',
    photo_url: props.media.brollPhoto,
    overlay_text: '',
    narration_line: '',
    duration_sec: STAT_SEGMENT_FRAMES / FPS,
    stat: SAMPLE_STAT,
    beat_index: 0,
  };
  const segments: Segment[] = [
    { frames: STAT_SEGMENT_FRAMES, label: 'C1 Current stat', node: <StatRevealBeat beat={beat} /> },
    { frames: STAT_SEGMENT_FRAMES, label: 'C2 KPI odometer', node: <KpiStat beat={beat} /> },
  ];
  return <SegmentRunner segments={segments} musicUrl={props.media.music} />;
};

export const BakeoffPhoto: React.FC<BakeoffProps> = (props) => {
  const photo = props.media.brollPhoto;
  const segments: Segment[] = [
    {
      frames: PHOTO_SEGMENT_FRAMES,
      label: 'D1 Current Ken Burns',
      node: (
        <AbsoluteFill>
          <BrollBeat
            beat={{
              type: 'broll',
              photo_url: photo,
              overlay_text: '',
              narration_line: '',
              duration_sec: PHOTO_SEGMENT_FRAMES / FPS,
              beat_index: 0,
            }}
            fps={FPS}
          />
        </AbsoluteFill>
      ),
    },
    { frames: PHOTO_SEGMENT_FRAMES, label: 'D2 Parallax depth', node: <ParallaxPhoto photoUrl={photo} /> },
  ];
  return <SegmentRunner segments={segments} musicUrl={props.media.music} />;
};
