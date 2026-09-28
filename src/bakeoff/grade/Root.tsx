import { Composition } from 'remotion';
import { GradeCells, CELLS_TOTAL_FRAMES } from './GradeCells';
import { GradeTiming, GradeVideo, SEGMENT_FRAMES, VIDEO_TOTAL_FRAMES } from './GradeVideo';
import { defaultGradeProps } from './types';
import { FPS } from '../types';

const common = { fps: FPS, width: 1080, height: 1920, defaultProps: defaultGradeProps } as const;

export const GradeRoot: React.FC = () => (
  <>
    <Composition id="GradeCells" component={GradeCells} durationInFrames={CELLS_TOTAL_FRAMES} {...common} />
    <Composition id="GradeVideo" component={GradeVideo} durationInFrames={VIDEO_TOTAL_FRAMES} {...common} />
    <Composition id="GradeTiming" component={GradeTiming} durationInFrames={SEGMENT_FRAMES} {...common} />
  </>
);
