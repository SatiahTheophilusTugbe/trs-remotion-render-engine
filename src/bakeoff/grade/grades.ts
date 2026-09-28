// Colour-grade definitions for the grading bake-off (PROTOTYPE, never imported by production).
// Pure typed data + pure math. Every grade is a bag of bounded numeric params; the SVG filter
// (feColorMatrix + feComponentTransfer tone tables + feGaussianBlur bloom) and the overlay layers
// in ColorGrade.tsx are derived from them deterministically.

export type Rgb = { r: number; g: number; b: number };
export type BlendMode = 'soft-light' | 'multiply' | 'screen' | 'overlay';

export type Grade = {
  id: 'G0' | 'G1' | 'G2' | 'G3' | 'G4';
  name: string;
  blurb: string;
  /** feColorMatrix saturate: 1 = unchanged, 0 = monochrome. */
  saturation: number;
  /** feColorMatrix hueRotate, degrees. */
  hueShift: number;
  /** 0..1 blend towards a smoothstep S-curve (pivot 0.5). */
  contrast: number;
  /** midtone gamma: >1 brightens, <1 darkens. */
  exposure: number;
  /** input levels: values at/below blackPoint become 0 (deeper blacks). */
  blackPoint: number;
  /** input levels: values at/above whitePoint become 1. */
  whitePoint: number;
  /** output floor (matte blacks). */
  blackLift: number;
  /** output ceiling (soft whites). */
  whiteCap: number;
  /** per-channel gain (white balance style). */
  channelGain: Rgb;
  /** additive per-channel offset weighted by (1 - v)^2 (shadows). */
  shadowTint: Rgb;
  /** additive per-channel offset weighted by 4v(1-v) (midtones). */
  midTint: Rgb;
  /** additive per-channel offset weighted by v^2 (highlights). */
  highlightTint: Rgb;
  /** Highlight bloom: luma above threshold, blurred (px at 1080 wide), tinted, screen-blended. */
  bloom: { threshold: number; radius: number; intensity: number; tint: Rgb };
  /** Radial darkening overlay. inner = fraction of the radius that stays clear. */
  vignette: { strength: number; inner: number; color: string };
  /** Two-colour vertical wash blended over the photo with a blend mode. */
  wash: { top: string; bottom: string; blend: BlendMode; opacity: number };
  /** Deterministic per-frame grain opacity (0 = off; grain layer is not rendered). */
  grain: number;
};

const ZERO: Rgb = { r: 0, g: 0, b: 0 };
const ONE: Rgb = { r: 1, g: 1, b: 1 };

export const G0: Grade = {
  id: 'G0',
  name: 'No grade',
  blurb: 'Reference: the untouched production look.',
  saturation: 1,
  hueShift: 0,
  contrast: 0,
  exposure: 1,
  blackPoint: 0,
  whitePoint: 1,
  blackLift: 0,
  whiteCap: 1,
  channelGain: ONE,
  shadowTint: ZERO,
  midTint: ZERO,
  highlightTint: ZERO,
  bloom: { threshold: 0.8, radius: 0, intensity: 0, tint: ONE },
  vignette: { strength: 0, inner: 0.6, color: '#000000' },
  wash: { top: '#000000', bottom: '#000000', blend: 'soft-light', opacity: 0 },
  grain: 0,
};

export const G1: Grade = {
  ...G0,
  id: 'G1',
  name: 'Broadcast Noir',
  blurb: 'Deep blacks, firm contrast, ~12% less saturation, cool blue-black shadows, neutral-warm highlights, soft vignette.',
  saturation: 0.88,
  contrast: 0.3,
  exposure: 0.97,
  blackPoint: 0.02,
  whitePoint: 0.985,
  whiteCap: 0.99,
  shadowTint: { r: -0.012, g: 0.004, b: 0.045 },
  highlightTint: { r: 0.022, g: 0.01, b: -0.012 },
  vignette: { strength: 0.42, inner: 0.5, color: '#02040a' },
};

export const G2: Grade = {
  ...G0,
  id: 'G2',
  name: 'Floodlight',
  blurb: 'Night-stadium: warm sodium highlights, cyan-shifted shadows, muted blue/green, top-lit warm wash, soft highlight bloom.',
  saturation: 0.9,
  hueShift: -3,
  contrast: 0.22,
  exposure: 0.98,
  blackPoint: 0.015,
  channelGain: { r: 1.02, g: 0.99, b: 0.96 },
  shadowTint: { r: -0.03, g: 0.028, b: 0.04 },
  midTint: { r: 0.008, g: 0.0, b: -0.012 },
  highlightTint: { r: 0.035, g: 0.016, b: -0.026 },
  bloom: { threshold: 0.7, radius: 14, intensity: 0.5, tint: { r: 1.0, g: 0.8, b: 0.52 } },
  vignette: { strength: 0.3, inner: 0.55, color: '#020a10' },
  wash: { top: '#ffa640', bottom: '#0a6a8a', blend: 'soft-light', opacity: 0.2 },
};

export const G3: Grade = {
  ...G0,
  id: 'G3',
  name: 'Third Rail Green-Black',
  blurb: 'Brand-owned: saturation ~0.6, shadows pushed to deep green-black so lime feels native, clean neutral highlights.',
  saturation: 0.6,
  contrast: 0.36,
  exposure: 1.0,
  blackPoint: 0.02,
  whitePoint: 0.98,
  channelGain: { r: 1.02, g: 1, b: 0.98 },
  shadowTint: { r: -0.03, g: 0.038, b: -0.02 },
  midTint: { r: 0.022, g: -0.008, b: -0.006 },
  highlightTint: { r: 0.0, g: 0.004, b: 0.0 },
  vignette: { strength: 0.5, inner: 0.48, color: '#010803' },
  wash: { top: '#0c3a16', bottom: '#041a0a', blend: 'soft-light', opacity: 0 },
};

export const G4: Grade = {
  ...G0,
  id: 'G4',
  name: 'Matte Editorial',
  blurb: 'Lifted matte blacks, soft contrast, gently warm highlights and haze, deterministic fine grain.',
  saturation: 0.92,
  contrast: 0.14,
  exposure: 1.0,
  blackLift: 0.075,
  whiteCap: 0.965,
  shadowTint: { r: 0.012, g: 0.006, b: -0.004 },
  highlightTint: { r: 0.026, g: 0.012, b: -0.02 },
  vignette: { strength: 0.16, inner: 0.6, color: '#0a0604' },
  wash: { top: '#ffd9a8', bottom: '#ffd9a8', blend: 'screen', opacity: 0.05 },
  grain: 0.11,
};

export const GRADES: Grade[] = [G0, G1, G2, G3, G4];

export const gradeById = (id: string): Grade => {
  for (const g of GRADES) if (g.id === id) return g;
  throw new Error(`Unknown grade id: ${id}`);
};

// ---------------------------------------------------------------------------------------------
// Bounds: every numeric param, addressed by dotted path, must lie inside [min, max].
// ---------------------------------------------------------------------------------------------
type Bound = readonly [number, number];
const TINT: Bound = [-0.1, 0.1];
const GAIN: Bound = [0.8, 1.2];
export const PARAM_BOUNDS: Record<string, Bound> = {
  saturation: [0, 1.5],
  hueShift: [-30, 30],
  contrast: [0, 0.8],
  exposure: [0.7, 1.4],
  blackPoint: [0, 0.1],
  whitePoint: [0.9, 1],
  blackLift: [0, 0.15],
  whiteCap: [0.85, 1],
  'channelGain.r': GAIN,
  'channelGain.g': GAIN,
  'channelGain.b': GAIN,
  'shadowTint.r': TINT,
  'shadowTint.g': TINT,
  'shadowTint.b': TINT,
  'midTint.r': TINT,
  'midTint.g': TINT,
  'midTint.b': TINT,
  'highlightTint.r': TINT,
  'highlightTint.g': TINT,
  'highlightTint.b': TINT,
  'bloom.threshold': [0.5, 0.95],
  'bloom.radius': [0, 80],
  'bloom.intensity': [0, 1],
  'bloom.tint.r': [0, 1],
  'bloom.tint.g': [0, 1],
  'bloom.tint.b': [0, 1],
  'vignette.strength': [0, 0.8],
  'vignette.inner': [0.3, 0.9],
  'wash.opacity': [0, 0.5],
  grain: [0, 0.3],
};

export const flattenParams = (g: Grade): Record<string, number> => ({
  saturation: g.saturation,
  hueShift: g.hueShift,
  contrast: g.contrast,
  exposure: g.exposure,
  blackPoint: g.blackPoint,
  whitePoint: g.whitePoint,
  blackLift: g.blackLift,
  whiteCap: g.whiteCap,
  'channelGain.r': g.channelGain.r,
  'channelGain.g': g.channelGain.g,
  'channelGain.b': g.channelGain.b,
  'shadowTint.r': g.shadowTint.r,
  'shadowTint.g': g.shadowTint.g,
  'shadowTint.b': g.shadowTint.b,
  'midTint.r': g.midTint.r,
  'midTint.g': g.midTint.g,
  'midTint.b': g.midTint.b,
  'highlightTint.r': g.highlightTint.r,
  'highlightTint.g': g.highlightTint.g,
  'highlightTint.b': g.highlightTint.b,
  'bloom.threshold': g.bloom.threshold,
  'bloom.radius': g.bloom.radius,
  'bloom.intensity': g.bloom.intensity,
  'bloom.tint.r': g.bloom.tint.r,
  'bloom.tint.g': g.bloom.tint.g,
  'bloom.tint.b': g.bloom.tint.b,
  'vignette.strength': g.vignette.strength,
  'vignette.inner': g.vignette.inner,
  'wash.opacity': g.wash.opacity,
  grain: g.grain,
});

export const gradeOutOfBounds = (g: Grade): string[] => {
  const flat = flattenParams(g);
  const bad: string[] = [];
  for (const key of Object.keys(PARAM_BOUNDS)) {
    const [lo, hi] = PARAM_BOUNDS[key];
    const v = flat[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) bad.push(key);
  }
  if (g.blackPoint >= g.whitePoint) bad.push('blackPoint>=whitePoint');
  if (g.blackLift >= g.whiteCap) bad.push('blackLift>=whiteCap');
  return bad;
};

// ---------------------------------------------------------------------------------------------
// Tone-curve maths (also unit-tested). One table per channel, sampled uniformly on [0,1].
// ---------------------------------------------------------------------------------------------
export const TABLE_SIZE = 33;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const toneCurve = (g: Grade, channel: 'r' | 'g' | 'b', x: number): number => {
  let v = clamp01((x - g.blackPoint) / (g.whitePoint - g.blackPoint));
  v = Math.pow(v, 1 / g.exposure);
  const s = v * v * (3 - 2 * v);
  v = v + g.contrast * (s - v);
  v = clamp01(v * g.channelGain[channel]);
  v =
    v +
    g.shadowTint[channel] * (1 - v) * (1 - v) +
    g.midTint[channel] * 4 * v * (1 - v) +
    g.highlightTint[channel] * v * v;
  v = g.blackLift + clamp01(v) * (g.whiteCap - g.blackLift);
  return clamp01(v);
};

export const toneTable = (g: Grade, channel: 'r' | 'g' | 'b', size: number = TABLE_SIZE): number[] => {
  const out: number[] = [];
  for (let i = 0; i < size; i++) out.push(toneCurve(g, channel, i / (size - 1)));
  return out;
};

export const tableValuesString = (table: number[]): string => table.map((v) => v.toFixed(4)).join(' ');
