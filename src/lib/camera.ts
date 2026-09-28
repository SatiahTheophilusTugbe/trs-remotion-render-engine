export type CameraFrame = {
  scale: number;
  translateXPct: number;
  translateYPct: number;
};

export type CameraMoveName =
  | 'zoomIn'
  | 'zoomOut'
  | 'panLeft'
  | 'panRight'
  | 'panUp'
  | 'panDown';

const PAN_SCALE = 1.12;
const PAN_EXTENT_PCT = (PAN_SCALE - 1) * 50; // max |translate%| the scale allows, e.g. 6

const ZOOM_IN_START = 1.0;
const ZOOM_IN_END = 1.1;
const ZOOM_OUT_START = 1.1;
const ZOOM_OUT_END = 1.0;

const lerp = (start: number, end: number, t: number): number => start + (end - start) * t;

export const CAMERA_MOVES: Record<CameraMoveName, (t: number) => CameraFrame> = {
  zoomIn: (t) => ({
    scale: lerp(ZOOM_IN_START, ZOOM_IN_END, t),
    translateXPct: 0,
    translateYPct: 0,
  }),
  zoomOut: (t) => ({
    scale: lerp(ZOOM_OUT_START, ZOOM_OUT_END, t),
    translateXPct: 0,
    translateYPct: 0,
  }),
  panLeft: (t) => ({
    scale: PAN_SCALE,
    translateXPct: lerp(PAN_EXTENT_PCT, -PAN_EXTENT_PCT, t),
    translateYPct: 0,
  }),
  panRight: (t) => ({
    scale: PAN_SCALE,
    translateXPct: lerp(-PAN_EXTENT_PCT, PAN_EXTENT_PCT, t),
    translateYPct: 0,
  }),
  panUp: (t) => ({
    scale: PAN_SCALE,
    translateXPct: 0,
    translateYPct: lerp(PAN_EXTENT_PCT, -PAN_EXTENT_PCT, t),
  }),
  panDown: (t) => ({
    scale: PAN_SCALE,
    translateXPct: 0,
    translateYPct: lerp(-PAN_EXTENT_PCT, PAN_EXTENT_PCT, t),
  }),
};

export const cameraFrameAt = (
  move: CameraMoveName,
  frame: number,
  durationInFrames: number,
): CameraFrame => {
  const t = durationInFrames <= 0 ? 0 : Math.min(Math.max(frame / durationInFrames, 0), 1);
  return CAMERA_MOVES[move](t);
};

const CAMERA_MOVE_NAMES: CameraMoveName[] = [
  'zoomIn',
  'zoomOut',
  'panLeft',
  'panRight',
  'panUp',
  'panDown',
];

// Deterministic PRNG (mulberry32), seeded per-index only — no Math.random/Date.now,
// so renders stay frame-pure and reproducible across runs.
const mulberry32 = (seed: number): number => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const assignCameraMoves = (beats: { duration_sec: number }[]): CameraMoveName[] => {
  const assignments: CameraMoveName[] = [];
  beats.forEach((_beat, index) => {
    const candidates = CAMERA_MOVE_NAMES.filter((name) => name !== assignments[index - 1]);
    const roll = mulberry32(index);
    const pickIndex = Math.floor(roll * candidates.length) % candidates.length;
    assignments.push(candidates[pickIndex]);
  });
  return assignments;
};
