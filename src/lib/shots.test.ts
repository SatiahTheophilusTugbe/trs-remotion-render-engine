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
  WIDE_SCALE,
  focalObjectPosition,
  photoLayout,
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

// Frame-space span of the box at zoom s with the same centring the renderer uses.
const span = (c: number, half: number, s: number) => {
  const t = Math.max(-(s - 1) / 2, Math.min((s - 1) / 2, -s * (c - 0.5)));
  return [0.5 + t + s * (c - half - 0.5), 0.5 + t + s * (c + half - 0.5)];
};

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
      for (const z of [s, s * MOVE_SCALE]) {
        const [x0, x1] = span(f.x, (f.w! * BOX_PAD) / 2 / vw, z);
        const [y0, y1] = span(f.y, (f.h! * BOX_PAD) / 2 / vh, z);
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
    for (const z of [s, s * MOVE_SCALE]) {
      const t = Math.max(-(z - 1) / 2, Math.min((z - 1) / 2, -z * (f.x - 0.5)));
      const toImg = (fx: number) => f.x + ((fx - 0.5 - t) / z + 0.5 - f.x) * vw;
      expect(toImg(0)).toBeLessThanOrEqual(0.38);
      expect(toImg(1)).toBeGreaterThanOrEqual(0.59);
    }
  });

  it('zooms less for a bigger subject', () => {
    const big = safeCropScale({ x: 0.5, y: 0.45, w: 0.3, h: 0.45 }, LANDSCAPE);
    expect(big === null || big < TIGHT_SCALE).toBe(true);
  });
});

describe('shotCount', () => {
  it('is always 1 when the beat cannot be cropped', () => {
    expect(shotCount(420, FPS, false)).toBe(1);
  });
  it.each([
    [10.9, 2],
    [9.4, 2],
    [14, 2],
    [6, 2],
    [5, 1],
    [2.5, 1],
    [1, 1],
  ])('%ss croppable -> %i shots', (sec, n) => {
    expect(shotCount(Math.round(sec * FPS), FPS, true)).toBe(n);
  });
});

describe('planShots', () => {
  it('no box: one full-frame wide shot spanning the beat', () => {
    const shots = planShots(330, FPS, opts({ focal: null }));
    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatchObject({ from: 0, durationInFrames: 330, scale: WIDE_SCALE, entry: 'slam', whiskOut: true });
  });

  it('line-up: one wide shot, never a crop', () => {
    const shots = planShots(420, FPS, opts({ focal: lineup }));
    expect(shots.map((s) => s.scale)).toEqual([WIDE_SCALE]);
  });

  it('single subject: wide then the safe tight crop', () => {
    expect(FRAMING_CYCLE).toEqual([WIDE_SCALE, TIGHT_SCALE, MID_SCALE]);
    expect(planShots(420, FPS, opts()).map((s) => s.scale)).toEqual([WIDE_SCALE, TIGHT_SCALE]);
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

  it('the inner cut is hardPunch or whip, varying by seed', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed <= 10; seed++) {
      const inner = planShots(420, FPS, opts({ seed })).slice(1).map((s) => s.entry);
      expect(inner).toHaveLength(1);
      expect(['hardPunch', 'whip']).toContain(inner[0]);
      seen.add(inner[0]);
    }
    expect(seen.size).toBe(2);
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
    expect(planShots(420, FPS, opts()).map((s) => s.whiskOut)).toEqual([false, true]);
    expect(planShots(420, FPS, opts({ whiskOut: false })).some((s) => s.whiskOut)).toBe(false);
  });

  it('returns no shots for an empty beat', () => {
    expect(planShots(0, FPS, opts())).toEqual([]);
  });
});

describe('focalObjectPosition', () => {
  it('maps focal to object-position percentages', () => {
    expect(focalObjectPosition({ x: 0.25, y: 0.4 })).toBe('25.00% 40.00%');
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
  it('a letterboxed photo is always a single shot', () => {
    expect(planShots(420, FPS, opts({ focal: lineup }))).toHaveLength(1);
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
