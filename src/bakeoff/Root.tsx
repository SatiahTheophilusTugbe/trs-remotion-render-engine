import { Composition } from 'remotion';
import { BakeoffCuts, CUTS_TOTAL_FRAMES } from './BakeoffCuts';
import { BakeoffBanner, BANNER_SEGMENT_FRAMES } from './BakeoffBanner';
import { BakeoffStat, BakeoffPhoto, STAT_SEGMENT_FRAMES, PHOTO_SEGMENT_FRAMES } from './BakeoffPhotoStat';
import { defaultBakeoffProps, FPS } from './types';

const common = { fps: FPS, width: 1080, height: 1920, defaultProps: defaultBakeoffProps } as const;

export const BakeoffRoot: React.FC = () => (
  <>
    <Composition id="BakeoffCuts" component={BakeoffCuts} durationInFrames={CUTS_TOTAL_FRAMES} {...common} />
    <Composition id="BakeoffBanner" component={BakeoffBanner} durationInFrames={BANNER_SEGMENT_FRAMES * 2} {...common} />
    <Composition id="BakeoffStat" component={BakeoffStat} durationInFrames={STAT_SEGMENT_FRAMES * 2} {...common} />
    <Composition id="BakeoffPhoto" component={BakeoffPhoto} durationInFrames={PHOTO_SEGMENT_FRAMES * 2} {...common} />
  </>
);
