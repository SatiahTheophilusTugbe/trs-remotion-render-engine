// PhotoGrade: wraps a photo `<Img>` or the avatar `<OffthreadVideo>` clip in the production colour
// grade -- G3 "Third Rail Green-Black", the sole shipped look (owner sign-off 2026-09-28). No
// grade-selection prop: this is a fixed brand decision, not a per-render option.
//
// Ported technique from src/bakeoff/grade/ColorGrade.tsx (production must not import from
// src/bakeoff/, so the technique is reimplemented here, not reused directly): one SVG filter
// (`feColorMatrix` saturate -> `feComponentTransfer` per-channel tone table) applied via CSS
// `filter: url(#...)` to an absolutely-positioned wrapper around `children`, plus a
// radial-gradient vignette overlay rendered as a sibling AFTER the filtered wrapper (so the
// vignette itself is composited on top, exactly like the bake-off).
//
// Wrap ONLY the photographic layer with this component -- never captions, banner, badges, the
// wipe/slide-push transition layer, or the stat card. Those must remain siblings outside this
// subtree so they render pixel-identical to an ungraded render (verified by a pixel diff, see
// task-3-report.md).
import { GRADE_G3, tableValuesString, toneTable } from '../lib/grade';

export type PhotoGradeProps = {
  children: React.ReactNode;
  /** Width (px) of the graded area. Grades are authored at the 1080-wide full photo background. */
  width?: number;
  /**
   * Whether to render the radial vignette overlay in addition to the filter. Defaults to true for
   * a full-bleed photo background. The bake-off's `GradedAvatarBox` wrapped the small 320x569
   * avatar corner clip with `layers="tone"` (filter only, no vignette) because G3's vignette reads
   * as a natural photo-vignette on a full frame but as an odd dark smudge on a small inset clip;
   * `AvatarBeat` passes `vignette={false}` to preserve that same choice.
   */
  vignette?: boolean;
};

const filterId = (width: number): string => `trs-grade-g3-${Math.round(width)}`;

const FilterDefs: React.FC<{ width: number }> = ({ width }) => (
  <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
    <defs>
      <filter id={filterId(width)} x="-3%" y="-3%" width="106%" height="106%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values={String(GRADE_G3.saturation)} />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={tableValuesString(toneTable('r'))} />
          <feFuncG type="table" tableValues={tableValuesString(toneTable('g'))} />
          <feFuncB type="table" tableValues={tableValuesString(toneTable('b'))} />
        </feComponentTransfer>
      </filter>
    </defs>
  </svg>
);

export const PhotoGrade: React.FC<PhotoGradeProps> = ({ children, width = 1080, vignette = true }) => {
  const showVignette = vignette && GRADE_G3.vignette.strength > 0;
  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate', overflow: 'hidden' }}>
      <FilterDefs width={width} />
      <div style={{ position: 'absolute', inset: 0, filter: `url(#${filterId(width)})` }}>{children}</div>
      {showVignette ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse 78% 62% at 50% 45%, transparent ${Math.round(GRADE_G3.vignette.inner * 100)}%, ${GRADE_G3.vignette.color} 100%)`,
            opacity: GRADE_G3.vignette.strength,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
};
