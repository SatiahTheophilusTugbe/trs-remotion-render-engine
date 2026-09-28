// Grade bake-off video + timing compositions (PROTOTYPE).
// GradeVideo: 4 x 5s segments (G1..G4), each the same real 3-beat sample (broll -> avatar -> stat)
// with all production overlays; the segment flashes to G0 (no grade) twice for reference.
// GradeTiming: one 5s segment with a single grade (and optional layer switch-offs), no chip and no
// music, used to measure per-frame render cost.
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import type { Beat } from '../../types/beat';
import { MusicBed } from '../../compositions/MusicBed';
import { montserratBold } from '../../lib/fonts';
import { G0, GRADES, gradeById } from './grades';
import type { Grade } from './grades';
import { GradeProvider, GradedBeatSequence, withDisabled } from './GradedBeats';
import type { GradeProps } from './types';

export const SEGMENT_FRAMES = 150; // 5.0s at 30fps
// [start, end) segment-local frames that flash to the ungraded reference.
export const G0_FLASHES: [number, number][] = [
  [0, 14],
  [64, 78],
];
export const VIDEO_GRADES = GRADES.slice(1);
export const VIDEO_TOTAL_FRAMES = SEGMENT_FRAMES * VIDEO_GRADES.length;

export const buildGradeBeats = (props: GradeProps): Beat[] => {
  const { media, story } = props;
  const broll = story.find((s) => s.type === 'broll') ?? story[0];
  const avatar = story.find((s) => s.type === 'avatar') ?? story[0];
  return [
    {
      type: 'broll',
      photo_url: media.brollPhoto,
      overlay_text: broll?.overlay_text ?? 'Sample headline',
      narration_line: '',
      duration_sec: 1.9,
      word_timings: broll?.word_timings ?? null,
      beat_index: 0,
    },
    {
      type: 'avatar',
      photo_url: media.avatarPhoto,
      clip_url: media.avatarClipStandin ?? '',
      overlay_text: '',
      narration_line: '',
      duration_sec: 1.7,
      word_timings: avatar?.word_timings ?? null,
      beat_index: 1,
    },
    {
      type: 'stat',
      photo_url: media.arenaPhoto,
      overlay_text: '',
      narration_line: '',
      duration_sec: 1.4,
      stat: { value: 27.4, label: 'Points per game', decimals: 1 },
      beat_index: 2,
    },
  ];
};

const Chip: React.FC<{ text: string }> = ({ text }) => (
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
      fontSize: 24,
      fontWeight: 700,
      whiteSpace: 'nowrap',
      border: '2px solid #fff',
    }}
  >
    {text}
  </div>
);

const flashing = (frame: number): boolean => G0_FLASHES.some(([a, b]) => frame >= a && frame < b);

const Segment: React.FC<{ props: GradeProps; grade: Grade; chip: boolean }> = ({ props, grade, chip }) => {
  const frame = useCurrentFrame();
  const active = chip && flashing(frame) ? G0 : grade;
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <GradeProvider value={active}>
        <GradedBeatSequence beats={buildGradeBeats(props)} leagueBadge="NBA" />
      </GradeProvider>
      {chip ? (
        <Chip text={active.id === 'G0' ? 'G0 NO GRADE (REFERENCE)' : `${active.id} ${active.name.toUpperCase()}`} />
      ) : null}
    </AbsoluteFill>
  );
};

export const GradeVideo: React.FC<GradeProps> = (props) => (
  <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
    {VIDEO_GRADES.map((g, i) => (
      <Sequence key={g.id} from={i * SEGMENT_FRAMES} durationInFrames={SEGMENT_FRAMES}>
        <Segment props={props} grade={g} chip />
      </Sequence>
    ))}
    {props.media.music ? <MusicBed src={props.media.music} /> : null}
  </AbsoluteFill>
);

export const GradeTiming: React.FC<GradeProps> = (props) => (
  <Segment props={props} grade={withDisabled(gradeById(props.gradeId), props.disable)} chip={false} />
);
