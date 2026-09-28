// ColorGrade (PROTOTYPE): grades ONLY what it wraps (photo background, avatar clip video).
// Brand overlays (captions, banner, badges, wipe, stat text, avatar border) are siblings that
// render AFTER/ABOVE this component and are therefore never touched.
//
// Portable primitives only (headless Chromium + Remotion Lambda):
//   * one SVG filter: feColorMatrix (saturate/hueRotate) -> feComponentTransfer (per-channel tone
//     tables) -> optional bloom (luma gate -> feGaussianBlur -> tint -> feBlend screen)
//   * overlay divs: vignette (radial-gradient), wash (linear-gradient + mix-blend-mode)
//   * optional deterministic grain: feTurbulence seeded from the frame number
import { useCurrentFrame } from 'remotion';
import type { Grade } from './grades';
import { tableValuesString, toneTable } from './grades';

export type GradeLayers = 'all' | 'tone' | 'none';

export type ColorGradeProps = {
  grade: Grade;
  children: React.ReactNode;
  /** Width of the graded area in px; scales the bloom radius (grades are authored at 1080). */
  width?: number;
  /** 'all' = filter + vignette + wash + grain; 'tone' = filter + wash; 'none' = filter only. */
  layers?: GradeLayers;
  /** Override the grain seed (default: the current Sequence-local frame). */
  grainSeed?: number;
};

const isIdentity = (g: Grade): boolean =>
  g.saturation === 1 &&
  g.hueShift === 0 &&
  g.contrast === 0 &&
  g.exposure === 1 &&
  g.blackPoint === 0 &&
  g.whitePoint === 1 &&
  g.blackLift === 0 &&
  g.whiteCap === 1 &&
  g.channelGain.r === 1 &&
  g.channelGain.g === 1 &&
  g.channelGain.b === 1 &&
  g.shadowTint.r === 0 &&
  g.shadowTint.g === 0 &&
  g.shadowTint.b === 0 &&
  g.midTint.r === 0 &&
  g.midTint.g === 0 &&
  g.midTint.b === 0 &&
  g.highlightTint.r === 0 &&
  g.highlightTint.g === 0 &&
  g.highlightTint.b === 0 &&
  g.bloom.intensity === 0;

const filterId = (g: Grade, width: number): string => `trs-grade-${g.id}-${Math.round(width)}`;

const FilterDefs: React.FC<{ grade: Grade; width: number }> = ({ grade: g, width }) => {
  const id = filterId(g, width);
  const scale = width / 1080;
  const bloomOn = g.bloom.intensity > 0 && g.bloom.radius > 0;
  const slope = 1 / (1 - g.bloom.threshold);
  const intercept = -g.bloom.threshold / (1 - g.bloom.threshold);
  const ir = g.bloom.intensity * g.bloom.tint.r;
  const ig = g.bloom.intensity * g.bloom.tint.g;
  const ib = g.bloom.intensity * g.bloom.tint.b;
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <filter id={id} x="-3%" y="-3%" width="106%" height="106%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values={String(g.saturation)} />
          {g.hueShift !== 0 ? <feColorMatrix type="hueRotate" values={String(g.hueShift)} /> : null}
          <feComponentTransfer result="graded">
            <feFuncR type="table" tableValues={tableValuesString(toneTable(g, 'r'))} />
            <feFuncG type="table" tableValues={tableValuesString(toneTable(g, 'g'))} />
            <feFuncB type="table" tableValues={tableValuesString(toneTable(g, 'b'))} />
          </feComponentTransfer>
          {bloomOn ? (
            <>
              <feColorMatrix
                in="graded"
                type="matrix"
                values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
              />
              <feComponentTransfer>
                <feFuncR type="linear" slope={slope} intercept={intercept} />
                <feFuncG type="linear" slope={slope} intercept={intercept} />
                <feFuncB type="linear" slope={slope} intercept={intercept} />
              </feComponentTransfer>
              <feGaussianBlur stdDeviation={g.bloom.radius * scale} />
              <feColorMatrix
                type="matrix"
                values={`${ir} 0 0 0 0  0 ${ig} 0 0 0  0 0 ${ib} 0 0  0 0 0 1 0`}
                result="glow"
              />
              <feBlend in="graded" in2="glow" mode="screen" />
            </>
          ) : null}
        </filter>
      </defs>
    </svg>
  );
};

const Grain: React.FC<{ seed: number; opacity: number }> = ({ seed, opacity }) => (
  <svg
    viewBox="0 0 540 960"
    preserveAspectRatio="none"
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      mixBlendMode: 'soft-light',
      opacity,
      pointerEvents: 'none',
    }}
  >
    <filter id="trs-grain" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed={seed} stitchTiles="stitch" />
      <feColorMatrix
        type="matrix"
        values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1"
      />
    </filter>
    <rect width="540" height="960" filter="url(#trs-grain)" />
  </svg>
);

export const ColorGrade: React.FC<ColorGradeProps> = ({
  grade,
  children,
  width = 1080,
  layers = 'all',
  grainSeed,
}) => {
  const frame = useCurrentFrame();
  const identity = isIdentity(grade);
  const showVignette = layers === 'all' && grade.vignette.strength > 0;
  const showWash = layers !== 'none' && grade.wash.opacity > 0;
  const showGrain = layers === 'all' && grade.grain > 0;
  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate', overflow: 'hidden' }}>
      {identity ? null : <FilterDefs grade={grade} width={width} />}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: identity ? undefined : `url(#${filterId(grade, width)})`,
        }}
      >
        {children}
      </div>
      {showWash ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, ${grade.wash.top} 0%, ${grade.wash.bottom} 100%)`,
            mixBlendMode: grade.wash.blend,
            opacity: grade.wash.opacity,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {showVignette ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse 78% 62% at 50% 45%, transparent ${Math.round(grade.vignette.inner * 100)}%, ${grade.vignette.color} 100%)`,
            opacity: grade.vignette.strength,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {showGrain ? <Grain seed={grainSeed ?? frame} opacity={grade.grain} /> : null}
    </div>
  );
};
