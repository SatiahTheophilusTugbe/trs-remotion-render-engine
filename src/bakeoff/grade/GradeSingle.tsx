// Single-grade video (PROTOTYPE). Renders ONE named grade (G1..G4) over the same real 3-beat
// sample used by GradeVideo (broll -> avatar -> stat), looped twice back-to-back (~10s total) so
// the reviewer sees at least one full beat cut (wipe + slide-push) in each grade's own file, with
// every production overlay visible (badges, glass banner, captions, lime wipe, odometer stat).
// A large, full-width label bar names the grade for the entire duration -- not a small corner
// chip -- so there is no ambiguity about which file is which. Never wired into production; the
// label bar and this composition are siblings of the graded content, so they are never graded.
import { AbsoluteFill } from 'remotion';
import type { Beat } from '../../types/beat';
import { MusicBed } from '../../compositions/MusicBed';
import { montserratBold } from '../../lib/fonts';
import { gradeById } from './grades';
import type { Grade } from './grades';
import { GradeProvider, GradedBeatSequence } from './GradedBeats';
import { buildGradeBeats, SEGMENT_FRAMES } from './GradeVideo';
import type { GradeProps } from './types';

export const SINGLE_REPEATS = 2;
export const SINGLE_TOTAL_FRAMES = SEGMENT_FRAMES * SINGLE_REPEATS;

const LABEL_BAR_HEIGHT = 132;

const GradeLabel: React.FC<{ grade: Grade }> = ({ grade }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: LABEL_BAR_HEIGHT,
      background: '#FF2BD6',
      borderTop: '3px solid #ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 28px',
      boxSizing: 'border-box',
    }}
  >
    <p
      style={{
        margin: 0,
        color: '#ffffff',
        fontFamily: montserratBold,
        fontWeight: 700,
        fontSize: 46,
        lineHeight: 1.15,
        textAlign: 'center',
        letterSpacing: '0.01em',
        textShadow: '0 2px 10px rgba(0,0,0,0.4)',
      }}
    >
      {`${grade.id} — ${grade.name.toUpperCase()}`}
    </p>
  </div>
);

// Two copies of the same 3-beat sample back-to-back: this gives 5 internal cut boundaries
// (wipe/slide-push) instead of just the 2 inside a single pass, well past the "at least one cut"
// bar, and lets the reviewer watch the grade survive a full loop.
const buildLoopedBeats = (props: GradeProps): Beat[] => {
  const once = buildGradeBeats(props);
  const twice: Beat[] = once.map((b) => ({ ...b, beat_index: b.beat_index + once.length }));
  return [...once, ...twice];
};

export const GradeSingle: React.FC<GradeProps> = (props) => {
  const grade = gradeById(props.gradeId);
  const beats = buildLoopedBeats(props);
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <GradeProvider value={grade}>
        <GradedBeatSequence beats={beats} leagueBadge="NBA" />
      </GradeProvider>
      <GradeLabel grade={grade} />
      {props.media.music ? <MusicBed src={props.media.music} /> : null}
    </AbsoluteFill>
  );
};
