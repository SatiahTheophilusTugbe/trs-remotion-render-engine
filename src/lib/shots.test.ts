import { describe, it, expect } from 'vitest';
import {
  isSmallPhoto,
  smallPhotoSize,
  FRAMING_CYCLE,
  HOLD_MOVES,
  MID_SCALE,
  MIN_CROP_SCALE,
  MOVE_SCALE,
  MOVE_SHIFT,
  SUBJECT_MARGIN,
  BOX_PAD,
  TIGHT_SCALE,
  INNER_CUTS,
  WIDE_SCALE,
  WIDE_MOVE_SCALE,
  WIDE_MOVE_SHIFT,
  FRAME_ASPECT,
  SUBJECT_TARGET_X,
  SUBJECT_TARGET_Y,
  focalObjectPosition,
  photoLayout,
  subjectFramePosition,
  subjectTranslate,
  wideMoveBudget,
  planShots,
  safeCropScale,
  shotCount,
  visibleFraction,
  type PlanOptions,
} from './shots';
import type { Focal } from '../types/beat';

const FPS = 30;
const LANDSCAPE = 3 / 2;
// A head-and-shoulders box in a typical 3:2 news photo.
const person: Focal = { x: 0.5, y: 0.4, w: 0.15, h: 0.25 };
// A team line-up / group celebration: the box spans most of the photo.
const lineup: Focal = { x: 0.5, y: 0.5, w: 0.9, h: 0.6 };
const opts = (o: Partial<PlanOptions> = {}): PlanOptions => ({
  focal: person,
  aspect: LANDSCAPE,
  seed: 0,
  slamIn: true,
  whiskOut: true,
  ...o,
});

// Frame-space span of the box at zoom s with the same centring the renderer uses: the box centre sits at
// frame fraction `at` (subjectFramePosition) and the zoom's clamped translate pulls it toward `target`.
const span = (at: number, half: number, s: number, target: number) => {
  const t = Math.max(-(s - 1) / 2, Math.min((s - 1) / 2, target - 0.5 - s * (at - 0.5)));
  return [0.5 + t + s * (at - half - 0.5), 0.5 + t + s * (at + half - 0.5)];
};
// object-position p on an axis with visible fraction v puts image point u at frame p(1 - 1/v) + u/v.
const toFrame = (u: number, p: number, v: number) => p * (1 - 1 / v) + u / v;
const pctOf = (objectPosition: string) => objectPosition.split(' ').map((t) => parseFloat(t) / 100);

describe('visibleFraction', () => {
  it('a landscape photo shows a narrow vertical strip; a tall photo a horizontal band', () => {
    expect(visibleFraction(1.5).vw).toBeCloseTo(0.375);
    expect(visibleFraction(1.5).vh).toBe(1);
    expect(visibleFraction(0.5).vw).toBe(1);
    expect(visibleFraction(0.5).vh).toBeCloseTo(0.5 / (1080 / 1920));
  });
});

describe('safeCropScale', () => {
  it('crops a single person to the full tight scale when the box allows', () => {
    expect(safeCropScale(person, LANDSCAPE)).toBe(TIGHT_SCALE);
  });

  it('never crops a line-up or group shot', () => {
    expect(safeCropScale(lineup, LANDSCAPE)).toBeNull();
  });

  it('never crops without a box or without the photo size', () => {
    expect(safeCropScale({ x: 0.5, y: 0.4 }, LANDSCAPE)).toBeNull();
    expect(safeCropScale(person, null)).toBeNull();
    expect(safeCropScale(null, LANDSCAPE)).toBeNull();
  });

  it('keeps the whole subject inside the frame margins, even near an edge and under a hold move', () => {
    const cases: Focal[] = [
      { x: 0.3, y: 0.3, w: 0.12, h: 0.3 },
      { x: 0.62, y: 0.45, w: 0.1, h: 0.2 },
      { x: 0.5, y: 0.2, w: 0.2, h: 0.3 },
      { x: 0.42, y: 0.45, w: 0.18, h: 0.4 },
    ];
    for (const f of cases) {
      const s = safeCropScale(f, LANDSCAPE);
      if (s === null) continue;
      const { vw, vh } = visibleFraction(LANDSCAPE);
      const p = subjectFramePosition(f, LANDSCAPE)!;
      for (const z of [s, s * MOVE_SCALE]) {
        const [x0, x1] = span(p.x, (f.w! * BOX_PAD) / 2 / vw, z, SUBJECT_TARGET_X);
        const [y0, y1] = span(p.y, (f.h! * BOX_PAD) / 2 / vh, z, SUBJECT_TARGET_Y);
        const m = SUBJECT_MARGIN + MOVE_SHIFT - 1e-9;
        expect(x0).toBeGreaterThanOrEqual(m);
        expect(x1).toBeLessThanOrEqual(1 - m);
        expect(y0).toBeGreaterThanOrEqual(m);
        expect(y1).toBeLessThanOrEqual(1 - m);
      }
      expect(s).toBeGreaterThanOrEqual(MIN_CROP_SCALE);
    }
  });

  it('a real (slightly off-centre) Claude head box keeps the true head on screen', () => {
    // Live 13a box for a press-conference photo (2048x1590); the true head spans x 0.40-0.57.
    const f: Focal = { x: 0.58, y: 0.22, w: 0.28, h: 0.3 };
    const aspect = 2048 / 1590;
    const s = safeCropScale(f, aspect);
    if (s === null) return; // staying wide is always safe
    const { vw } = visibleFraction(aspect);
    const p = subjectFramePosition(f, aspect)!;
    for (const z of [s, s * MOVE_SCALE]) {
      const t = subjectTranslate(p.x, SUBJECT_TARGET_X, z);
      // frame X -> pre-zoom frame point -> image fraction (box centre f.x sits at frame p.x)
      const toImg = (fx: number) => f.x + ((fx - 0.5 - t) / z + 0.5 - p.x) * vw;
      expect(toImg(0)).toBeLessThanOrEqual(0.38);
      expect(toImg(1)).toBeGreaterThanOrEqual(0.59);
    }
  });

  it('an off-centre subject now gets the same crop as a centred one (it is centred first)', () => {
    expect(safeCropScale({ x: 0.3, y: 0.4, w: 0.15, h: 0.25 }, LANDSCAPE)).toBe(safeCropScale(person, LANDSCAPE));
    expect(safeCropScale({ x: 0.72, y: 0.4, w: 0.15, h: 0.25 }, LANDSCAPE)).toBe(safeCropScale(person, LANDSCAPE));
  });

  it('zooms less for a bigger subject', () => {
    const big = safeCropScale({ x: 0.5, y: 0.45, w: 0.3, h: 0.45 }, LANDSCAPE);
    expect(big === null || big < TIGHT_SCALE).toBe(true);
  });
});

describe('shotCount', () => {
  // Owner 2026-10-08: re-cut every ~5.5s (never under 3s, at most 4), whether or not the photo can be cropped.
  it.each([
    [17.6, 4],
    [15.3, 3],
    [12.1, 3],
    [10.9, 2],
    [10, 2],
    [6, 2],
    [5, 1],
    [2.5, 1],
    [1, 1],
    [40, 4],
  ])('%ss -> %i shots', (sec, n) => {
    expect(shotCount(Math.round(sec * FPS), FPS)).toBe(n);
  });
});

describe('planShots', () => {
  it('no box, short beat: one full-frame wide shot spanning the beat', () => {
    const shots = planShots(150, FPS, opts({ focal: null }));
    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatchObject({ from: 0, durationInFrames: 150, scale: WIDE_SCALE, entry: 'slam', whiskOut: true });
  });

  it('no box, long beat (live 17.6s upload): re-cut into wide shots with the big wide moves', () => {
    const shots = planShots(528, FPS, opts({ focal: null }));
    expect(shots).toHaveLength(4);
    shots.forEach((s) => expect(s).toMatchObject({ scale: WIDE_SCALE, moveScale: WIDE_MOVE_SCALE, moveShift: WIDE_MOVE_SHIFT }));
  });

  it('line-up: wide shots only, never a crop', () => {
    const shots = planShots(420, FPS, opts({ focal: lineup }));
    expect(new Set(shots.map((s) => s.scale))).toEqual(new Set([WIDE_SCALE]));
  });

  it('long croppable beat alternates wide and the safe crop; only crops use the small budgeted move', () => {
    const shots = planShots(528, FPS, opts());
    expect(shots.map((s) => s.scale)).toEqual([WIDE_SCALE, TIGHT_SCALE, WIDE_SCALE, TIGHT_SCALE]);
    expect(shots.map((s) => s.moveScale)).toEqual([WIDE_MOVE_SCALE, MOVE_SCALE, WIDE_MOVE_SCALE, MOVE_SCALE]);
  });

  it('single subject: wide then the safe tight crop', () => {
    expect(FRAMING_CYCLE).toEqual([WIDE_SCALE, TIGHT_SCALE, MID_SCALE]);
    expect(planShots(300, FPS, opts()).map((s) => s.scale)).toEqual([WIDE_SCALE, TIGHT_SCALE]);
  });

  it('shots tile the beat exactly', () => {
    for (const d of [30, 282, 327, 333, 420]) {
      const shots = planShots(d, FPS, opts());
      expect(shots[0].from).toBe(0);
      for (let i = 1; i < shots.length; i++) {
        expect(shots[i].from).toBe(shots[i - 1].from + shots[i - 1].durationInFrames);
      }
      expect(shots.reduce((s, x) => s + x.durationInFrames, 0)).toBe(d);
    }
  });

  it('first entry is slam only when slamIn', () => {
    expect(planShots(420, FPS, opts())[0].entry).toBe('slam');
    expect(planShots(420, FPS, opts({ slamIn: false }))[0].entry).toBe('none');
  });

  it('inner cuts are random per cut: all four types used, never the same twice in a row', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed <= 30; seed++) {
      const inner = planShots(528, FPS, opts({ seed })).slice(1).map((s) => s.entry);
      expect(inner).toHaveLength(3);
      inner.forEach((e) => expect(INNER_CUTS).toContain(e));
      for (let k = 1; k < inner.length; k++) expect(inner[k]).not.toBe(inner[k - 1]);
      seen.add(inner.join(','));
      inner.forEach((e) => seen.add(e));
    }
    INNER_CUTS.forEach((c) => expect(seen).toContain(c));
    expect(seen.size).toBeGreaterThan(INNER_CUTS.length + 5); // many different orders, not a fixed cycle
  });

  it('a lime-wipe beat sweeps in and out instead of slamming and whisking', () => {
    const shots = planShots(528, FPS, opts({ sweepIn: true, sweepOut: true }));
    expect(shots[0].entry).toBe('sweep');
    expect(shots.map((s) => s.sweepOut)).toEqual([false, false, false, true]);
    expect(shots.some((s) => s.whiskOut)).toBe(false);
  });

  it('every shot gets a hold move; consecutive shots differ; beats vary across the whole pool', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed <= 20; seed++) {
      const shots = planShots(420, FPS, opts({ seed }));
      shots.forEach((s) => expect(HOLD_MOVES).toContain(s.move));
      for (let i = 1; i < shots.length; i++) expect(shots[i].move).not.toBe(shots[i - 1].move);
      shots.forEach((s) => seen.add(s.move));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('is deterministic for the same seed', () => {
    expect(planShots(420, FPS, opts({ seed: 7 }))).toEqual(planShots(420, FPS, opts({ seed: 7 })));
  });

  it('whiskOut only on the last shot and only when requested', () => {
    expect(planShots(300, FPS, opts()).map((s) => s.whiskOut)).toEqual([false, true]);
    expect(planShots(528, FPS, opts()).map((s) => s.whiskOut)).toEqual([false, false, false, true]);
    expect(planShots(420, FPS, opts({ whiskOut: false })).some((s) => s.whiskOut)).toBe(false);
  });

  it('returns no shots for an empty beat', () => {
    expect(planShots(0, FPS, opts())).toEqual([]);
  });
});

describe('subjectFramePosition (owner 2026-10-11: subjects centred, not at their proportional spot)', () => {
  const W169 = 16 / 9;
  it('a subject at x=0.22 in a landscape photo lands at the frame centre', () => {
    const pos = subjectFramePosition({ x: 0.22, y: 0.45 }, W169)!;
    expect(pos.x).toBeCloseTo(0.5, 9);
    const [px] = pctOf(pos.objectPosition);
    expect(toFrame(0.22, px, visibleFraction(W169).vw)).toBeCloseTo(0.5, 4);
    expect(px).toBeGreaterThan(0);
    expect(px).toBeLessThan(1);
  });
  it('clamps at the photo edges (x=0.02 / 0.98): object-position 0% / 100%, no edge exposed', () => {
    const { vw } = visibleFraction(W169);
    const l = subjectFramePosition({ x: 0.02, y: 0.5 }, W169)!;
    const r = subjectFramePosition({ x: 0.98, y: 0.5 }, W169)!;
    expect(pctOf(l.objectPosition)[0]).toBe(0);
    expect(pctOf(r.objectPosition)[0]).toBe(1);
    expect(l.x).toBeCloseTo(0.02 / vw, 9); // as far toward the centre as the photo allows
    expect(r.x).toBeCloseTo(1 - 0.02 / vw, 9);
    expect(l.x).toBeLessThan(0.5);
    expect(r.x).toBeGreaterThan(0.5);
  });
  it('object-position is always within 0..100% (never exposes an edge)', () => {
    for (const aspect of [0.4, 0.5625, 0.8, 1, 1.5, 16 / 9, 3]) {
      for (const x of [0, 0.02, 0.22, 0.5, 0.77, 0.98, 1]) {
        for (const y of [0, 0.1, 0.42, 0.9, 1]) {
          const [px, py] = pctOf(subjectFramePosition({ x, y }, aspect)!.objectPosition);
          expect(px).toBeGreaterThanOrEqual(0);
          expect(px).toBeLessThanOrEqual(1);
          expect(py).toBeGreaterThanOrEqual(0);
          expect(py).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it('vertically places the box centre ~42% down on a tall photo, clamped at the top', () => {
    const tall = 0.4; // visible band vh = 0.4 / 0.5625
    const { vh } = visibleFraction(tall);
    const pos = subjectFramePosition({ x: 0.5, y: 0.35 }, tall)!;
    expect(pos.y).toBeCloseTo(SUBJECT_TARGET_Y, 9);
    expect(SUBJECT_TARGET_Y).toBeCloseTo(0.42);
    expect(toFrame(0.35, pctOf(pos.objectPosition)[1], vh)).toBeCloseTo(0.42, 4);
    const top = subjectFramePosition({ x: 0.5, y: 0.05 }, tall)!;
    expect(pctOf(top.objectPosition)[1]).toBe(0);
    expect(top.y).toBeCloseTo(0.05 / vh, 9);
  });
  it('an axis that is fully visible is unaffected (landscape y, portrait x)', () => {
    expect(subjectFramePosition({ x: 0.3, y: 0.22 }, W169)!.y).toBe(0.22);
    expect(subjectFramePosition({ x: 0.3, y: 0.22 }, 0.4)!.x).toBe(0.3);
    expect(subjectFramePosition({ x: 0.3, y: 0.22 }, FRAME_ASPECT)).toEqual({ x: 0.3, y: 0.22, objectPosition: '30.00% 22.00%' });
  });
  it('no focal: null; unknown photo size: the old proportional placement', () => {
    expect(subjectFramePosition(null, W169)).toBeNull();
    expect(subjectFramePosition({ x: 0.22, y: 0.45 }, null)).toEqual({ x: 0.22, y: 0.45, objectPosition: '22.00% 45.00%' });
  });
});

describe('wideMoveBudget (owner 2026-10-11: wide moves must not push the subject out)', () => {
  it('photos without a box keep the full dramatic wide move', () => {
    expect(wideMoveBudget(null, LANDSCAPE)).toEqual({ moveScale: WIDE_MOVE_SCALE, moveShift: WIDE_MOVE_SHIFT });
    expect(wideMoveBudget({ x: 0.5, y: 0.4 }, LANDSCAPE)).toEqual({ moveScale: WIDE_MOVE_SCALE, moveShift: WIDE_MOVE_SHIFT });
  });
  it('a small, centred box keeps the full wide move', () => {
    expect(wideMoveBudget(person, LANDSCAPE)).toEqual({ moveScale: WIDE_MOVE_SCALE, moveShift: WIDE_MOVE_SHIFT });
  });
  it('a bigger box gets a reduced move, never below the tight move', () => {
    const b = wideMoveBudget({ x: 0.5, y: 0.45, w: 0.2, h: 0.35 }, LANDSCAPE);
    expect(b.moveScale).toBeLessThan(WIDE_MOVE_SCALE);
    expect(b.moveScale).toBeGreaterThanOrEqual(MOVE_SCALE);
    expect(b.moveShift).toBeLessThan(WIDE_MOVE_SHIFT);
    expect(b.moveShift).toBeGreaterThanOrEqual(MOVE_SHIFT);
  });
  it('a box that can never fit (real beat 6: w 0.52 on 16:9) gets the tight scale and zero drift', () => {
    expect(wideMoveBudget({ x: 0.48, y: 0.36, w: 0.52, h: 0.55 }, 3382 / 1902)).toEqual({ moveScale: MOVE_SCALE, moveShift: 0 });
  });
  it('the chosen budget keeps the padded box inside the margins over the whole hold', () => {
    for (const f of [{ x: 0.5, y: 0.45, w: 0.2, h: 0.35 }, { x: 0.3, y: 0.3, w: 0.18, h: 0.4 }, { x: 0.6, y: 0.5, w: 0.22, h: 0.35 }]) {
      const b = wideMoveBudget(f, LANDSCAPE);
      if (b.moveShift === 0) continue;
      const { vw, vh } = visibleFraction(LANDSCAPE);
      const p = subjectFramePosition(f, LANDSCAPE)!;
      const m = SUBJECT_MARGIN + b.moveShift - 1e-9;
      for (const z of [WIDE_SCALE, WIDE_SCALE * b.moveScale]) {
        const [x0, x1] = span(p.x, (f.w * BOX_PAD) / 2 / vw, z, SUBJECT_TARGET_X);
        const [y0, y1] = span(p.y, (f.h * BOX_PAD) / 2 / vh, z, SUBJECT_TARGET_Y);
        expect(x0).toBeGreaterThanOrEqual(m);
        expect(x1).toBeLessThanOrEqual(1 - m);
        expect(y0).toBeGreaterThanOrEqual(m);
        expect(y1).toBeLessThanOrEqual(1 - m);
      }
    }
  });
  it('letterboxed / small-card photos (whole photo shown) keep the full wide move', () => {
    expect(wideMoveBudget(lineup, LANDSCAPE, 'letterbox')).toEqual({ moveScale: WIDE_MOVE_SCALE, moveShift: WIDE_MOVE_SHIFT });
    expect(wideMoveBudget(person, LANDSCAPE, 'small')).toEqual({ moveScale: WIDE_MOVE_SCALE, moveShift: WIDE_MOVE_SHIFT });
  });
  it('a box on a photo of unknown size gets the tight move (cannot be checked)', () => {
    expect(wideMoveBudget(person, null)).toEqual({ moveScale: MOVE_SCALE, moveShift: MOVE_SHIFT });
  });
  it('planShots: wide shots use the budget, tight shots keep MOVE_SCALE / MOVE_SHIFT', () => {
    const big = { x: 0.5, y: 0.45, w: 0.2, h: 0.35 };
    const b = wideMoveBudget(big, LANDSCAPE);
    planShots(528, FPS, opts({ focal: big })).forEach((s) => {
      if (s.scale === WIDE_SCALE) expect({ moveScale: s.moveScale, moveShift: s.moveShift }).toEqual(b);
      else expect({ moveScale: s.moveScale, moveShift: s.moveShift }).toEqual({ moveScale: MOVE_SCALE, moveShift: MOVE_SHIFT });
    });
  });
  it('planShots: a zero-drift budget turns drifts / rises into push / pull, never the same move twice', () => {
    const loose = { x: 0.48, y: 0.36, w: 0.52, h: 0.55 };
    for (let seed = 0; seed <= 20; seed++) {
      const shots = planShots(528, FPS, opts({ focal: loose, aspect: 3382 / 1902, seed }));
      shots.forEach((s) => expect(['pushIn', 'pullOut']).toContain(s.move));
      for (let i = 1; i < shots.length; i++) expect(shots[i].move).not.toBe(shots[i - 1].move);
    }
  });
});

describe('real AVS-mv3zrl17 beats (owner 2026-10-11)', () => {
  it('beat 4 (p3, 768x432, Norris + Piastri circle): box centred, both faces inside the visible strip', () => {
    const f = { x: 0.22, y: 0.45, w: 0.38, h: 0.75 };
    const aspect = 768 / 432;
    const pos = subjectFramePosition(f, aspect)!;
    expect(pos.x).toBeCloseTo(0.5, 6);
    const { vw } = visibleFraction(aspect);
    const b = wideMoveBudget(f, aspect);
    // Visible image window at the largest steady zoom of the wide shot (centred on the box).
    const z = WIDE_SCALE * b.moveScale;
    const left = f.x - vw / (2 * z);
    const right = f.x + vw / (2 * z);
    // Piastri's face ~0.09-0.19, Norris's ~0.27-0.34 of the photo width (boxes.jpg).
    expect(left).toBeLessThan(0.09);
    expect(right).toBeGreaterThan(0.34);
  });
  it('beat 5 (p4) stays centred on its box', () => {
    expect(subjectFramePosition({ x: 0.48, y: 0.32, w: 0.52, h: 0.48 }, 1600 / 900)!.x).toBeCloseTo(0.5, 6);
  });
});

describe('focalObjectPosition', () => {
  it('without the photo size: maps focal to object-position percentages (old placement)', () => {
    expect(focalObjectPosition({ x: 0.25, y: 0.4 })).toBe('25.00% 40.00%');
  });
  it('with the photo size: the centring object-position', () => {
    expect(focalObjectPosition({ x: 0.22, y: 0.45 }, 16 / 9)).toBe(subjectFramePosition({ x: 0.22, y: 0.45 }, 16 / 9)!.objectPosition);
  });
  it('falls back to the existing centre-top framing', () => {
    expect(focalObjectPosition(null)).toBe('center top');
    expect(focalObjectPosition(undefined)).toBe('center top');
  });
});

describe('photoLayout', () => {
  it('letterboxes a landscape group photo whose box is wider than the visible strip', () => {
    expect(photoLayout(lineup, LANDSCAPE)).toBe('letterbox');
  });
  it('keeps full-bleed cover for a single person, no box, unknown size, or a portrait photo', () => {
    expect(photoLayout(person, LANDSCAPE)).toBe('cover');
    expect(photoLayout(null, LANDSCAPE)).toBe('cover');
    expect(photoLayout({ x: 0.5, y: 0.5 }, LANDSCAPE)).toBe('cover');
    expect(photoLayout(lineup, null)).toBe('cover');
    expect(photoLayout(lineup, 0.5)).toBe('cover');
  });
  it('a single person with a wide box (live run 39961: w 0.32-0.38) stays full-bleed cover, never letterbox', () => {
    for (const f of [{ x: 0.55, y: 0.2, w: 0.32, h: 0.22 }, { x: 0.42, y: 0.26, w: 0.35, h: 0.32 }, { x: 0.55, y: 0.28, w: 0.38, h: 0.38 }]) {
      expect(photoLayout(f, LANDSCAPE)).toBe('cover');
    }
  });
  it('a medium subject that fits the strip uncropped stays cover', () => {
    expect(photoLayout({ x: 0.5, y: 0.45, w: 0.22, h: 0.6 }, LANDSCAPE)).toBe('cover');
  });
  it('a letterboxed photo is never cropped', () => {
    expect(planShots(528, FPS, opts({ focal: lineup })).every((s) => s.scale === WIDE_SCALE)).toBe(true);
  });
});

describe('small photos (A6)', () => {
  it('a 300x390 upload is shown small at 2x, never blown up to fill the frame', () => {
    expect(isSmallPhoto(300, 390)).toBe(true);
    expect(photoLayout(null, 300 / 390, 300, 390)).toBe('small');
    expect(smallPhotoSize(300, 390)).toEqual({ width: 600, height: 780 });
  });
  it('normal photos keep their layout', () => {
    expect(isSmallPhoto(1200, 740)).toBe(false);
    expect(photoLayout(null, 1200 / 740, 1200, 740)).toBe('cover');
    expect(isSmallPhoto(undefined, undefined)).toBe(false);
  });
  it('the card never exceeds 90% of the frame', () => {
    const s = smallPhotoSize(590, 100);
    expect(s.width).toBeLessThanOrEqual(972);
  });
});
