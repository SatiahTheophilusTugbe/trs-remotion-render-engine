// Contact-sheet cells (PROTOTYPE). Composition frame i renders cell (row = floor(i / 5), grade
// column = i % 5). Render with --sequence so one browser session yields every cell as a PNG.
// Every cell is shown at the same Sequence-local frame (LOCAL_FRAME) so captions / banner / wipe
// are identical across the five grade columns.
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { BrandBadges } from '../../compositions/BrandBadges';
import { CaptionLayer } from '../../compositions/CaptionLayer';
import { GlassBanner } from '../../compositions/GlassBanner';
import { TransitionLayer } from '../../compositions/TransitionLayer';
import { parseWordTimings } from '../../lib/captions';
import { GRADES } from './grades';
import { GradeProvider, GradedAvatarBox, GradedPhoto } from './GradedBeats';
import type { GradeMedia, GradeProps } from './types';

export const LOCAL_FRAME = 30;
export type CellKind = 'photo' | 'avatarFull' | 'wipe';
export type CellRow = {
  key: string;
  label: string;
  kind: CellKind;
  photo: keyof GradeMedia;
  exposure: number;
};

export const ROWS: CellRow[] = [
  { key: 'face', label: 'Portrait face', kind: 'photo', photo: 'brollPhoto', exposure: 1 },
  { key: 'bright', label: 'White jersey / bright (+35% exposure)', kind: 'photo', photo: 'avatarPhoto', exposure: 1.35 },
  { key: 'dark', label: 'Dark arena (-40% exposure)', kind: 'photo', photo: 'arenaPhoto', exposure: 0.6 },
  { key: 'avatarbox', label: 'Avatar box + badges + banner + captions', kind: 'avatarFull', photo: 'avatarPhoto', exposure: 1 },
  { key: 'wipe', label: 'Lime wipe + badges + captions (lime test)', kind: 'wipe', photo: 'brollPhoto', exposure: 1 },
  { key: 'skinMbappe', label: 'Skin: medium (unshifted)', kind: 'photo', photo: 'avatarPhoto', exposure: 1 },
  { key: 'skinArena', label: 'Skin: dark (unshifted)', kind: 'photo', photo: 'arenaPhoto', exposure: 1 },
];

export const CELL_COLUMNS = GRADES.length;
export const CELLS_TOTAL_FRAMES = ROWS.length * CELL_COLUMNS;

const wordsFor = (props: GradeProps, type: string) => {
  const b = props.story.find((s) => s.type === type) ?? props.story[0];
  return parseWordTimings(b?.word_timings ?? null);
};

const Cell: React.FC<{ row: CellRow; props: GradeProps }> = ({ row, props }) => {
  const url = props.media[row.photo];
  const bannerText = (props.story.find((s) => s.type === 'broll') ?? props.story[0])?.overlay_text ?? 'Sample headline';
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <GradedPhoto photoUrl={url} exposure={row.exposure} />
      {row.kind === 'avatarFull' ? (
        <>
          <GradedAvatarBox clipUrl={props.media.avatarClipStandin ?? ''} />
          <GlassBanner text={bannerText} />
          <CaptionLayer words={wordsFor(props, 'avatar')} variant="avatar" />
          <BrandBadges leagueBadge="NBA" />
        </>
      ) : null}
      {row.kind === 'wipe' ? (
        <>
          <CaptionLayer words={wordsFor(props, 'broll')} variant="broll" />
          <TransitionLayer cuts={[LOCAL_FRAME - 2]} />
          <BrandBadges leagueBadge="NBA" />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

export const GradeCells: React.FC<GradeProps> = (props) => {
  const i = useCurrentFrame();
  const row = ROWS[Math.min(Math.floor(i / CELL_COLUMNS), ROWS.length - 1)];
  const grade = GRADES[i % CELL_COLUMNS];
  // Sequence-local frame = i - from = LOCAL_FRAME for every cell.
  return (
    <Sequence from={i - LOCAL_FRAME}>
      <GradeProvider value={grade}>
        <Cell row={row} props={props} />
      </GradeProvider>
    </Sequence>
  );
};
