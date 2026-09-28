import type { StoryBeat } from '../types';

// Filled at render time from out/grade-props.json (gitignored, written by make-props.mjs).
// No media URL ever lives in source.
export type GradeMedia = {
  avatarPhoto: string | null; // portrait, white jersey (bright)
  avatarClipStandin: string | null;
  brollPhoto: string | null; // portrait, face
  music: string | null;
  arenaPhoto: string | null; // arena, mid/dark
};

export type GradeDisable = 'bloom' | 'grain' | 'vignette' | 'wash';

export type GradeProps = {
  media: GradeMedia;
  story: StoryBeat[];
  /** GradeTiming only: which grade to render (G0..G4). */
  gradeId: string;
  /** GradeTiming only: switch individual grade layers off to attribute cost. */
  disable: GradeDisable[];
};

export const emptyGradeMedia: GradeMedia = {
  avatarPhoto: null,
  avatarClipStandin: null,
  brollPhoto: null,
  music: null,
  arenaPhoto: null,
};

export const defaultGradeProps: GradeProps = {
  media: emptyGradeMedia,
  story: [],
  gradeId: 'G0',
  disable: [],
};
