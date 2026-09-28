// TRS production colour grade: "G3 -- Third Rail Green-Black", the sole shipped look.
//
// Owner decision (2026-09-28): ship G3 as the production grade. Do not ship G1/G2/G4, and do not
// add a grade-selection prop -- this is a fixed brand decision, not a per-render option.
//
// Numeric params below are copied verbatim from the bake-off's G3 definition
// (src/bakeoff/grade/grades.ts). Production code must not import from src/bakeoff/ (that tree is
// read-only prototype reference), so the params and the tone-curve maths are duplicated here,
// specialised to G3 only.
//
// G3's other bake-off fields -- hueShift (0), bloom (intensity 0), wash (opacity 0) and grain (0)
// -- are all no-ops for this grade (see grades.ts and grade-report.md: "the shadow/mid tint alone
// carries the green-black character; a separate colour wash looked muddy ... and was zeroed out
// during tuning"). They are intentionally NOT reimplemented below: there is no code path that
// could ever exercise them for a single hard-coded grade, so keeping them would just be dead code.

export type Rgb = { r: number; g: number; b: number };
export type Channel = 'r' | 'g' | 'b';

export const GRADE_G3 = {
  id: 'G3',
  name: 'Third Rail Green-Black',
  saturation: 0.6,
  contrast: 0.36,
  exposure: 1.0,
  blackPoint: 0.02,
  whitePoint: 0.98,
  channelGain: { r: 1.02, g: 1, b: 0.98 } as Rgb,
  shadowTint: { r: -0.03, g: 0.038, b: -0.02 } as Rgb,
  midTint: { r: 0.022, g: -0.008, b: -0.006 } as Rgb,
  highlightTint: { r: 0.0, g: 0.004, b: 0.0 } as Rgb,
  vignette: { strength: 0.5, inner: 0.48, color: '#010803' },
} as const;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Per-channel tone curve for G3, same maths as the bake-off's `toneCurve` (grades.ts) with the
 * grade fixed to G3: normalise to [blackPoint, whitePoint] -> exposure gamma -> smoothstep
 * contrast blend -> channel gain -> shadow/mid/highlight tint (weighted by (1-v)^2 / 4v(1-v) /
 * v^2) -> clamp. (G3's blackLift is 0 and whiteCap is 1, so the bake-off's final
 * `blackLift + v * (whiteCap - blackLift)` remap is a no-op and is omitted here.)
 */
export const toneCurve = (channel: Channel, x: number): number => {
  let v = clamp01((x - GRADE_G3.blackPoint) / (GRADE_G3.whitePoint - GRADE_G3.blackPoint));
  v = Math.pow(v, 1 / GRADE_G3.exposure);
  const s = v * v * (3 - 2 * v);
  v = v + GRADE_G3.contrast * (s - v);
  v = clamp01(v * GRADE_G3.channelGain[channel]);
  v =
    v +
    GRADE_G3.shadowTint[channel] * (1 - v) * (1 - v) +
    GRADE_G3.midTint[channel] * 4 * v * (1 - v) +
    GRADE_G3.highlightTint[channel] * v * v;
  return clamp01(v);
};

export const TABLE_SIZE = 33;

export const toneTable = (channel: Channel, size: number = TABLE_SIZE): number[] => {
  const out: number[] = [];
  for (let i = 0; i < size; i++) out.push(toneCurve(channel, i / (size - 1)));
  return out;
};

export const tableValuesString = (table: number[]): string => table.map((v) => v.toFixed(4)).join(' ');
