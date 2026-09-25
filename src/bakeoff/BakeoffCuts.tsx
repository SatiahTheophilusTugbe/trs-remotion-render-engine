import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { Beat } from '../types/beat';
import { layoutBeats, totalFrames } from '../lib/layout';
import { cutFrames } from '../lib/transitions';
import { TransitionLayer } from '../compositions/TransitionLayer';
import { BeatContent, SegmentRunner, buildSampleBeats, DARK, BEAT_SECONDS } from './shared';
import type { Segment } from './shared';
import type { BakeoffProps } from './types';
import { FPS } from './types';
import type { FxProps } from './fx/fx';
import { WhipPanFx } from './fx/WhipPanFx';
import { IrisFx } from './fx/IrisFx';
import { SlideShakeFx } from './fx/SlideShakeFx';

const Passthrough: React.FC<FxProps> = ({ children }) => <>{children}</>;

const CutsSegment: React.FC<{ beats: Beat[]; Fx: React.FC<FxProps>; useProductionWipe?: boolean }> = ({
  beats,
  Fx,
  useProductionWipe,
}) => {
  const { fps } = useVideoConfig();
  const slots = layoutBeats(beats, fps);
  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      {beats.map((beat, i) => (
        <Sequence key={i} from={slots[i].from} durationInFrames={slots[i].durationInFrames}>
          <Fx isFirst={i === 0} isLast={i === beats.length - 1}>
            <BeatContent beat={beat} />
          </Fx>
        </Sequence>
      ))}
      {useProductionWipe ? <TransitionLayer cuts={cutFrames(slots)} /> : null}
    </AbsoluteFill>
  );
};

const variants: { label: string; Fx: React.FC<FxProps>; wipe?: boolean }[] = [
  { label: 'A1 Current lime wipe', Fx: Passthrough, wipe: true },
  { label: 'A2 Whip-pan', Fx: WhipPanFx },
  { label: 'A3 Iris wipe', Fx: IrisFx },
  { label: 'A4 Slide push + shake', Fx: SlideShakeFx },
];

export const CUTS_SEGMENT_FRAMES = 4 * Math.round(BEAT_SECONDS * FPS);
export const CUTS_TOTAL_FRAMES = CUTS_SEGMENT_FRAMES * variants.length;

export const BakeoffCuts: React.FC<BakeoffProps> = (props) => {
  const beats = buildSampleBeats(props);
  const segments: Segment[] = variants.map((v) => ({
    frames: totalFrames(layoutBeats(beats, FPS)),
    label: v.label,
    node: <CutsSegment beats={beats} Fx={v.Fx} useProductionWipe={v.wipe} />,
  }));
  return <SegmentRunner segments={segments} musicUrl={props.media.music} />;
};
