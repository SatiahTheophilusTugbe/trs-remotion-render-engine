import { describe, it, expect } from 'vitest';
import {
  ALL_HOLD_MOVES,
  BOX_PAD,
  CORE_MARGIN,
  HOLD_MOVES,
  WIDE_FLOOR_SCALE,
  WIDE_SCALE,
  faceCore,
  wideMoveBudget,
  MOVE_SCALE,
  MOVE_SHIFT,
  SUBJECT_MARGIN,
  SUBJECT_TARGET_X,
  SUBJECT_TARGET_Y,
  WIDE_MOVE_SCALE,
  WIDE_MOVE_SHIFT,
  planShots,
  subjectFramePosition,
  visibleFraction,
  type PlanOptions,
} from './shots';
import {
  CRASH_FRAMES,
  CRASH_OUT_FRAMES,
  PUNCH_FRAMES,
  SHAKE_FRAMES,
  SLAM_FRAMES,
  SWEEP_IN_FRAMES,
  SWEEP_OUT_FRAMES,
  WHIP_FRAMES,
  WHISK_FRAMES,
  holdMove,
  shotFrameAt,
  type ShotFrame,
} from './shotMotion';
import { WIPE_HALF_FRAMES } from './transitions';
import type { Focal } from '../types/beat';

const FPS = 30;
const person: Focal = { x: 0.5, y: 0.4, w: 0.15, h: 0.25 };
const ASPECT = 1.5;
const plan = (d: number, o: Partial<PlanOptions> = {}) =>
  planShots(d, FPS, { focal: person, aspect: ASPECT, seed: 0, slamIn: true, whiskOut: true, ...o });
// shotFrameAt takes the subject centre in FRAME space, as the renderer places it (useShotFrame).
const at = (f: Focal | null, aspect = ASPECT) => subjectFramePosition(f, aspect);

describe('shotFrameAt edge safety', () => {
  const focals: (Focal | null)[] = [
    null,
    { x: 0, y: 0 },
    { x: 1, y: 1, w: 0.1, h: 0.1 },
    person,
    { x: 0.8, y: 0.2, w: 0.1, h: 0.2 },
    { x: 0.5, y: 0.5, w: 0.9, h: 0.6 }, // a group wider than the strip: pans (objectX)
    { x: 0.05, y: 0.3, w: 0.5, h: 0.2 }, // a group pan pinched at the photo's left edge
    { x: 0.95, y: 0.7, w: 0.5, h: 0.2 }, // ... and at its right edge
  ];
  it('never exposes an edge on any frame', () => {
    const violations: string[] = [];
    for (const focal of focals) {
      for (let seed = 0; seed <= 5; seed++) {
        for (const [d, sweep] of [[30, false], [282, false], [420, false], [528, false], [528, true], [300, true], [30, true]] as const) {
          const shots = plan(d, { focal, seed, sweepIn: sweep, sweepOut: sweep });
          for (let f = 0; f < d; f++) {
            const s = shotFrameAt(shots, f, at(focal));
            const limit = (s.scale - 1) * 50 + 1e-9;
            const badX = s.objectX !== undefined && !(s.objectX >= 0 && s.objectX <= 1);
            if (s.scale < 1 || Math.abs(s.txPct) > limit || Math.abs(s.tyPct) > limit || badX) {
              violations.push(JSON.stringify({ focal, seed, d, f, s }));
            }
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('poster frame', () => {
  it('the first frame of a beat without a slam is sharp and full-frame', () => {
    for (let seed = 0; seed <= 10; seed++) {
      for (const focal of [null, person]) {
        const shots = plan(330, { slamIn: false, focal, seed });
        const s = shotFrameAt(shots, 0, at(focal));
        expect(s.blurX + s.blurY).toBe(0);
        expect(shots[0].scale).toBeLessThan(1.05); // wide, not a crop
      }
    }
  });
});

describe('slam', () => {
  const shots = plan(420);
  it('starts oversized and blurred', () => {
    const s = shotFrameAt(shots, 0, at(person));
    expect(s.scale).toBeGreaterThanOrEqual(shots[0].scale * 1.2);
    expect(s.blurY).toBeGreaterThan(0);
  });
  it('has landed and is sharp after slam + shake', () => {
    const s = shotFrameAt(shots, SLAM_FRAMES + SHAKE_FRAMES, at(person));
    expect(s.scale / shots[0].scale).toBeLessThan(WIDE_MOVE_SCALE + 0.02);
    expect(s.blurX + s.blurY).toBe(0);
  });
  it('is skipped when slamIn is false', () => {
    const noSlam = plan(420, { slamIn: false });
    const s = shotFrameAt(noSlam, 0, at(person));
    expect(s.scale).toBeLessThanOrEqual(noSlam[0].scale * WIDE_MOVE_SCALE + 1e-9);
    expect(s.blurX + s.blurY).toBe(0);
  });
});

describe('inner cuts', () => {
  const withEntry = (entry: string) => {
    for (let seed = 0; seed < 50; seed++) {
      const shots = plan(420, { seed });
      if (shots[1].entry === entry) return shots;
    }
    throw new Error('no seed for ' + entry);
  };

  it('hard punch pops the first frame of the shot', () => {
    const shots = withEntry('hardPunch');
    const pop = shotFrameAt(shots, shots[1].from, at(person)).scale;
    const later = shotFrameAt(shots, shots[1].from + 3, at(person)).scale;
    expect(pop).toBeGreaterThan(later * 1.015);
  });

  it('whip blurs both sides of the cut, not mid-shot', () => {
    const shots = withEntry('whip');
    expect(shotFrameAt(shots, shots[1].from - 1, at(person)).blurX).toBeGreaterThan(0);
    expect(shotFrameAt(shots, shots[1].from, at(person)).blurX).toBeGreaterThan(0);
    const mid = shots[1].from + Math.floor(shots[1].durationInFrames / 2);
    expect(shotFrameAt(shots, mid, at(person)).blurX).toBe(0);
  });
});

describe('whisk', () => {
  it('zooms through with blur on the last frame', () => {
    const shots = plan(420);
    const last = shots[shots.length - 1];
    const s = shotFrameAt(shots, 419, at(person));
    expect(s.scale).toBeGreaterThanOrEqual(last.scale * 1.2);
    expect(s.blurY).toBeGreaterThan(0);
  });
  it('is skipped when whiskOut is false', () => {
    const s = shotFrameAt(plan(420, { whiskOut: false }), 419, at(person));
    expect(s.blurX + s.blurY).toBe(0);
  });
});

describe('hold moves', () => {
  it('every move visibly changes the frame across the shot (wide and tight amplitudes)', () => {
    for (const [amt, shift] of [[WIDE_MOVE_SCALE, WIDE_MOVE_SHIFT], [MOVE_SCALE, MOVE_SHIFT]]) {
      for (const move of ALL_HOLD_MOVES) {
        const a = holdMove(move, 0, amt, shift);
        const b = holdMove(move, 1, amt, shift);
        const scaleChange = Math.abs(b.m - a.m);
        const sh = Math.max(Math.abs(b.dx - a.dx), Math.abs(b.dy - a.dy));
        expect(scaleChange >= amt - 1 - 1e-9 || sh >= 2 * shift * 100 - 1e-9).toBe(true);
      }
    }
  });
  it('wide moves are dramatic: at least a 15% push or a 12%-of-frame drift', () => {
    for (const move of ALL_HOLD_MOVES) {
      const a = holdMove(move, 0);
      const b = holdMove(move, 1);
      expect(Math.abs(b.m - a.m) >= 0.15 || Math.max(Math.abs(b.dx - a.dx), Math.abs(b.dy - a.dy)) >= 12).toBe(true);
    }
  });
  it('moves launch fast out of the cut and never stall before the next one', () => {
    for (const move of ALL_HOLD_MOVES) {
      const v = (t: number) => {
        const p = holdMove(move, t);
        const q = holdMove(move, t + 0.01);
        return Math.abs(q.m - p.m) * 100 + Math.abs(q.dx - p.dx) + Math.abs(q.dy - p.dy);
      };
      const avg = (v(0) + v(0.25) + v(0.5) + v(0.75) + v(0.98)) / 5;
      expect(v(0)).toBeGreaterThan(v(0.5));
      for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98]) expect(v(t)).toBeGreaterThan(avg * 0.25);
    }
  });
  it('fall is rise reversed (photo moves down), same zoom', () => {
    for (const t of [0, 0.3, 0.7, 1]) {
      const r = holdMove('rise', t);
      const f = holdMove('fall', t);
      expect(f.m).toBe(r.m);
      expect(f.dx).toBe(0);
      expect(f.dy).toBeCloseTo(-r.dy, 12);
    }
    expect(holdMove('fall', 1).dy).toBeGreaterThan(holdMove('fall', 0).dy);
    expect(HOLD_MOVES).not.toContain('fall'); // the seeded pool is unchanged; fall only replaces a side drift
  });
  it('a beat without a box still moves (never idle)', () => {
    const shots = plan(330, { focal: null, slamIn: false, whiskOut: false });
    const a = shotFrameAt(shots, 0, null);
    const b = shotFrameAt(shots, 329, null);
    const moved = Math.abs(b.scale - a.scale) / a.scale >= 0.05 || Math.abs(b.txPct - a.txPct) >= 4 || Math.abs(b.tyPct - a.tyPct) >= 4;
    expect(moved).toBe(true);
  });
});

describe('framing', () => {
  // Frame-space centre of the subject box for one rendered frame.
  const centreAt = (s: { scale: number; txPct: number; tyPct: number }, p: { x: number; y: number }) => ({
    x: 0.5 + s.txPct / 100 + s.scale * (p.x - 0.5),
    y: 0.5 + s.tyPct / 100 + s.scale * (p.y - 0.5),
  });
  it('an off-centre subject sits at the frame centre (x) and ~42% down on the tight shot (owner 2026-10-11)', () => {
    const right: Focal = { x: 0.65, y: 0.4, w: 0.15, h: 0.25 };
    const left: Focal = { x: 0.35, y: 0.4, w: 0.15, h: 0.25 };
    for (const f of [right, left]) {
      const shots = plan(420, { focal: f, slamIn: false });
      expect(shots[1].scale).toBeGreaterThan(1.1); // the tight crop
      const p = at(f)!;
      for (const k of [10, Math.floor(shots[1].durationInFrames / 2), shots[1].durationInFrames - 10]) {
        const c = centreAt(shotFrameAt(shots, shots[1].from + k, p), p);
        expect(Math.abs(c.x - SUBJECT_TARGET_X)).toBeLessThanOrEqual(MOVE_SHIFT + 1e-9); // only the budgeted drift
      }
    }
  });
  it('pulls an edge subject (clamped object-position) toward the centre on the tight shot', () => {
    // A tall photo: the subject's object-position clamps, so the zoom's translate does the rest.
    const f: Focal = { x: 0.5, y: 0.06, w: 0.1, h: 0.08 };
    const aspect = 0.4;
    const p = at(f, aspect)!;
    expect(p.y).toBeLessThan(SUBJECT_TARGET_Y);
    const shots = plan(420, { focal: f, aspect, slamIn: false });
    const mid = shots[1].from + Math.floor(shots[1].durationInFrames / 2);
    expect(shotFrameAt(shots, mid, p).tyPct).toBeGreaterThan(0);
  });
  it('is deterministic', () => {
    const shots = plan(420, { seed: 3 });
    expect(shotFrameAt(shots, 100, at(person))).toEqual(shotFrameAt(shots, 100, at(person)));
  });
  it('the hold never pushes past the whisk window', () => {
    const shots = plan(330, { focal: null });
    const pre = shotFrameAt(shots, 330 - WHISK_FRAMES - 1, null);
    expect(pre.blurX + pre.blurY).toBe(0);
  });
});

describe('lime-wipe sweep (owner 2026-10-08)', () => {
  const shots = plan(528, { sweepIn: true, sweepOut: true });
  it('enters already moving right (with the wipe), blurred, and is sharp once settled', () => {
    const a = shotFrameAt(shots, 0, at(person));
    const b = shotFrameAt(shots, 4, at(person));
    expect(b.txPct).toBeGreaterThan(a.txPct);
    expect(a.blurX).toBeGreaterThan(0);
    expect(a.blurY).toBe(0); // no slam
    const settled = shotFrameAt(shots, SWEEP_IN_FRAMES, at(person));
    expect(settled.blurX + settled.blurY).toBe(0);
  });
  it('settles only after the wipe has cleared the frame', () => {
    expect(SWEEP_IN_FRAMES).toBeGreaterThan(WIPE_HALF_FRAMES);
  });
  it('holds still while sweeping in, then the hold move starts from rest', () => {
    const one = plan(150, { focal: null, sweepIn: true, whiskOut: false });
    const hold0 = shotFrameAt(one, SWEEP_IN_FRAMES, null);
    const hold1 = shotFrameAt(one, SWEEP_IN_FRAMES + 30, null);
    expect(hold1).not.toEqual(hold0);
  });
  it('the outgoing photo is shoved right under the wipe, never whisked', () => {
    const before = shotFrameAt(shots, 528 - SWEEP_OUT_FRAMES - 1, at(person));
    const last = shotFrameAt(shots, 527, at(person));
    expect(last.txPct).toBeGreaterThan(before.txPct);
    expect(last.blurX).toBeGreaterThan(0);
    expect(last.blurY).toBe(0);
    expect(before.blurX + before.blurY).toBe(0);
  });
});

describe('random inner cuts', () => {
  const find = (entry: string) => {
    for (let seed = 0; seed < 80; seed++) {
      const shots = plan(528, { seed });
      const i = shots.findIndex((s, k) => k > 0 && s.entry === entry);
      if (i > 0) return { shots, i };
    }
    throw new Error('no seed for ' + entry);
  };
  it('vertical whip blurs vertically on both sides of the cut', () => {
    const { shots, i } = find('whipUp');
    expect(shotFrameAt(shots, shots[i].from - 1, at(person)).blurY).toBeGreaterThan(0);
    expect(shotFrameAt(shots, shots[i].from, at(person)).blurY).toBeGreaterThan(0);
  });
  it('crash zoom lands oversized and blurred, then is sharp', () => {
    const { shots, i } = find('crashZoom');
    const a = shotFrameAt(shots, shots[i].from, at(person));
    const b = shotFrameAt(shots, shots[i].from + 8, at(person));
    expect(a.scale).toBeGreaterThan(b.scale * 1.15);
    expect(a.blurX).toBeGreaterThan(0);
    expect(b.blurX + b.blurY).toBe(0);
  });
});

describe('subject safety in the steady state (owner 2026-10-11, round 2: face core on wide shots)', () => {
  // Frames inside an entry / exit transient (slam, shake, whip, crash, punch, sweep, whisk) are short;
  // every OTHER frame must keep the face CORE inside CORE_MARGIN on wide shots, and (unchanged from
  // ca657d2) the padded box inside SUBJECT_MARGIN on tight (cropped) shots.
  const ENTRY: Record<string, number> = {
    none: 0,
    slam: SLAM_FRAMES + SHAKE_FRAMES,
    sweep: SWEEP_IN_FRAMES,
    hardPunch: PUNCH_FRAMES,
    whip: WHIP_FRAMES,
    whipUp: WHIP_FRAMES,
    crashZoom: CRASH_FRAMES,
  };
  const EXIT = Math.max(WHIP_FRAMES, CRASH_OUT_FRAMES, SWEEP_OUT_FRAMES, WHISK_FRAMES);
  const SHAPES = [[300, false], [420, true], [528, false], [528, true]] as const;
  const cases: [string, Focal, number][] = [
    ['person 3:2', person, 1.5],
    ['left of centre', { x: 0.3, y: 0.35, w: 0.12, h: 0.3 }, 1.5],
    ['near the right edge (y drift only)', { x: 0.85, y: 0.4, w: 0.1, h: 0.2 }, 1.5],
    ['high head, 16:9', { x: 0.62, y: 0.3, w: 0.12, h: 0.22 }, 16 / 9],
    ['portrait photo', { x: 0.5, y: 0.25, w: 0.3, h: 0.2 }, 0.75],
    ['bigger box', { x: 0.5, y: 0.45, w: 0.2, h: 0.35 }, 1.5],
    ['bigger box off-centre', { x: 0.6, y: 0.5, w: 0.22, h: 0.35 }, 1.5],
    ['big subject, push / pull only', { x: 0.3, y: 0.3, w: 0.32, h: 0.4 }, 1.5],
    ['real beat 2 (p1)', { x: 0.647, y: 0.231, w: 0.233, h: 0.451 }, 1200 / 799],
    ['real beat 4 (p3, two faces)', { x: 0.2, y: 0.278, w: 0.221, h: 0.268 }, 768 / 432],
    ['real beat 5 (p4)', { x: 0.525, y: 0.371, w: 0.237, h: 0.653 }, 1600 / 900],
    ['real beat 6 (p5)', { x: 0.636, y: 0.429, w: 0.322, h: 0.784 }, 3382 / 1902],
    ['round-3 beat 2 (p1)', { x: 0.654, y: 0.249, w: 0.261, h: 0.498 }, 1200 / 799],
    ['round-3 beat 4 (p3, two faces)', { x: 0.186, y: 0.307, w: 0.288, h: 0.424 }, 768 / 432],
    ['round-3 beat 5 (p4)', { x: 0.504, y: 0.358, w: 0.318, h: 0.716 }, 1600 / 900],
    ['round-3 beat 6 (p5)', { x: 0.578, y: 0.295, w: 0.23, h: 0.588 }, 3382 / 1902],
  ];
  const span = (s: ShotFrame, at: number, half: number, axis: 'x' | 'y') => {
    const t = (axis === 'x' ? s.txPct : s.tyPct) / 100;
    return [0.5 + t + s.scale * (at - half - 0.5), 0.5 + t + s.scale * (at + half - 0.5)];
  };
  it.each(cases)('%s: core (wide) / padded box (tight) stays in frame on every steady frame', (_n, f, aspect) => {
    expect(wideMoveBudget(f, aspect).pullOnly).toBe(false);
    const p = at(f, aspect)!;
    const core = faceCore(f, aspect)!;
    const { vw, vh } = visibleFraction(aspect);
    const pad = { halfW: (f.w! * BOX_PAD) / 2 / vw, halfH: (f.h! * BOX_PAD) / 2 / vh };
    const bad: string[] = [];
    for (let seed = 0; seed <= 8; seed++) {
      for (const [d, sweep] of SHAPES) {
        const shots = plan(d, { focal: f, aspect, seed, sweepIn: sweep, sweepOut: sweep });
        for (const shot of shots) {
          const wide = shot.scale === WIDE_SCALE;
          const box = wide ? core : pad;
          const m = (wide ? CORE_MARGIN : SUBJECT_MARGIN) - 1e-6;
          for (let k = ENTRY[shot.entry]; k < shot.durationInFrames - EXIT; k++) {
            const s = shotFrameAt(shots, shot.from + k, p);
            const [x0, x1] = span(s, p.x, box.halfW, 'x');
            const [y0, y1] = span(s, p.y, box.halfH, 'y');
            if (x0 < m || x1 > 1 - m || y0 < m || y1 > 1 - m) bad.push(`${seed}/${d}/${shot.from + k}/${shot.move}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
  it('a pull-only shot (giant close-up face) visibly pulls out and ends at the widest framing', () => {
    const giant: Focal = { x: 0.48, y: 0.4, w: 0.45, h: 0.75 }; // face-shaped (a wider one would pan: groupPan)
    const aspect = 3382 / 1902;
    const p = at(giant, aspect)!;
    for (let seed = 0; seed <= 4; seed++) {
      const shots = plan(528, { focal: giant, aspect, seed, slamIn: false, whiskOut: false });
      for (const shot of shots) {
        expect(shot.move).toBe('pullOut');
        const a = shotFrameAt(shots, shot.from + ENTRY[shot.entry], p); // first frame after the cut's transient
        // Last frame before the exit transient (the next cut's whip / crash) -- the hold is nearly done.
        const z = shotFrameAt(shots, shot.from + shot.durationInFrames - 1 - EXIT, p);
        expect(shot.moveScale).toBe(WIDE_FLOOR_SCALE); // starts at the floor zoom ...
        expect(z.scale).toBeLessThan(WIDE_SCALE * 1.03); // ... ends (almost) wide
        expect(a.scale / z.scale).toBeGreaterThan(1.06); // a visible pull, never a still
      }
    }
  });
  it('transients settle: after its entry the frame is exactly the hold move (nothing left over)', () => {
    for (let seed = 0; seed <= 8; seed++) {
      const focal: Focal = { x: 0.3, y: 0.35, w: 0.12, h: 0.3 };
      const shots = plan(528, { seed, focal });
      for (const shot of shots.slice(1)) {
        const k = ENTRY[shot.entry];
        const s = shotFrameAt(shots, shot.from + k, at(focal));
        expect(s.blurX + s.blurY).toBe(0);
        const hold = holdMove(shot.move, k / (shot.durationInFrames - 1), shot.moveScale, shot.moveShift);
        expect(s.scale).toBeCloseTo(Math.max(1, shot.scale * hold.m), 9);
      }
    }
  });
  it('zero motion is impossible: every wide shot of every boxed photo visibly moves (rendered frames)', () => {
    const still: string[] = [];
    let shotsChecked = 0;
    for (const aspect of [0.5, 0.75, 1.5, 16 / 9, 2.4]) {
      for (const x of [0.1, 0.5, 0.85]) {
        for (const y of [0.1, 0.4, 0.8]) {
          for (const w of [0.08, 0.25, 0.5]) {
            for (const h of [0.15, 0.45, 0.85]) {
              const f: Focal = { x, y, w, h };
              const p = at(f, aspect);
              for (const seed of [0, 1, 2]) {
                const shots = plan(420, { focal: f, aspect, seed, slamIn: false, whiskOut: false });
                for (const shot of shots) {
                  if (shot.scale !== WIDE_SCALE) continue;
                  shotsChecked++;
                  const k0 = ENTRY[shot.entry];
                  const a = shotFrameAt(shots, shot.from + k0, p);
                  const b = shotFrameAt(shots, shot.from + shot.durationInFrames - 1 - EXIT, p);
                  const zoom = Math.abs(b.scale - a.scale) / a.scale;
                  // A group pan travels mostly through the object-position: count the visible window's
                  // centre travel (in % of the frame width at zoom 1) as well.
                  const v = shot.pan?.vw ?? 1;
                  const centre = (s: ShotFrame) => v * (0.5 - s.txPct / 100 / s.scale) + (s.objectX ?? 0) * (1 - v);
                  const panTravel = shot.pan ? (Math.abs(centre(b) - centre(a)) / v) * 100 : 0;
                  const pan = Math.max(Math.abs(b.txPct - a.txPct), Math.abs(b.tyPct - a.tyPct), panTravel);
                  if (!(zoom >= 0.05 || pan >= 3)) still.push(JSON.stringify({ f, aspect, seed, move: shot.move, zoom, pan }));
                }
              }
            }
          }
        }
      }
    }
    expect(shotsChecked).toBeGreaterThan(1000);
    expect(still).toEqual([]);
  });
});

describe('group pan reveal on rendered frames (owner 2026-10-12, real beat 4 p3)', () => {
  const P3: Focal = { x: 0.201, y: 0.31, w: 0.39, h: 0.456 };
  const A3 = 768 / 432;
  const PIASTRI = [0.1, 0.2];
  const NORRIS = [0.23, 0.36];
  const ENTRY: Record<string, number> = {
    none: 0,
    slam: SLAM_FRAMES + SHAKE_FRAMES,
    sweep: SWEEP_IN_FRAMES,
    hardPunch: PUNCH_FRAMES,
    whip: WHIP_FRAMES,
    whipUp: WHIP_FRAMES,
    crashZoom: CRASH_FRAMES,
  };
  const EXIT = Math.max(WHIP_FRAMES, CRASH_OUT_FRAMES, SWEEP_OUT_FRAMES, WHISK_FRAMES);
  const { vw } = visibleFraction(A3);
  // Visible image window (image-width units) of a pan frame: object-position objectX, then the zoom + translate.
  const win = (s: ShotFrame) => {
    const t = s.txPct / 100;
    const f0 = 0.5 - (0.5 + t) / s.scale;
    const f1 = 0.5 + (0.5 - t) / s.scale;
    return [vw * f0 + s.objectX! * (1 - vw), vw * f1 + s.objectX! * (1 - vw)];
  };
  const inside = (w: number[], face: number[]) => w[0] <= face[0] && w[1] >= face[1];
  it('steady state: box middle and box height always on screen, each face whole at one end, direction alternates', () => {
    const pos = at(P3, A3)!;
    const bad: string[] = [];
    let shotsChecked = 0;
    for (let seed = 0; seed <= 8; seed++) {
      for (const [d, sweep] of [[300, false], [396, true], [528, false], [528, true]] as const) {
        const shots = plan(d, { focal: P3, aspect: A3, layout: 'cover', seed, sweepIn: sweep, sweepOut: sweep });
        shots.forEach((shot, i) => {
          shotsChecked++;
          const k0 = ENTRY[shot.entry];
          const k1 = shot.durationInFrames - 1 - EXIT;
          const first = win(shotFrameAt(shots, shot.from + k0, pos));
          const last = win(shotFrameAt(shots, shot.from + k1, pos));
          for (const [face, name] of [[PIASTRI, 'Piastri'], [NORRIS, 'Norris']] as const) {
            if (!inside(first, face) && !inside(last, face)) bad.push(`${seed}/${d}/shot${i}: ${name} never whole`);
          }
          // Shot 1 (and every even shot) pans left -> right: the window moves right; odd shots the reverse.
          const moved = (last[0] + last[1]) / 2 - (first[0] + first[1]) / 2;
          if (i % 2 === 0 ? !(moved > 0.05) : !(moved < -0.05)) bad.push(`${seed}/${d}/shot${i}: direction ${moved}`);
          for (let k = k0; k <= k1; k++) {
            const s = shotFrameAt(shots, shot.from + k, pos);
            const [l, r] = win(s);
            const m = (CORE_MARGIN * vw) / s.scale;
            if (!(l >= -1e-9 && r <= 1 + 1e-9)) bad.push(`${seed}/${d}/${shot.from + k}: photo edge ${l} ${r}`);
            if (!(l <= P3.x - m && r >= P3.x + m)) bad.push(`${seed}/${d}/${shot.from + k}: box middle out ${l} ${r}`);
            // Vertically (the whole height shows at zoom 1 on a landscape photo): the box's full height in frame.
            const ty = s.tyPct / 100;
            const y0 = 0.5 + ty + s.scale * (P3.y - P3.h! / 2 - 0.5);
            const y1 = 0.5 + ty + s.scale * (P3.y + P3.h! / 2 - 0.5);
            if (!(y0 >= CORE_MARGIN - 1e-6 && y1 <= 1 - CORE_MARGIN + 1e-6)) bad.push(`${seed}/${d}/${shot.from + k}: box height ${y0} ${y1}`);
          }
        });
      }
    }
    expect(shotsChecked).toBeGreaterThan(80);
    expect(bad).toEqual([]);
  });
  it('the pan visibly moves: ~30% of the frame width across a shot, plus the gentle push', () => {
    const pos = at(P3, A3)!;
    const shots = plan(396, { focal: P3, aspect: A3, layout: 'cover', seed: 3, slamIn: false, whiskOut: false });
    for (const shot of shots) {
      const a = shotFrameAt(shots, shot.from + ENTRY[shot.entry], pos);
      const b = shotFrameAt(shots, shot.from + shot.durationInFrames - 1, pos);
      const [wa, wb] = [win(a), win(b)];
      expect(Math.abs((wb[0] + wb[1]) / 2 - (wa[0] + wa[1]) / 2) / vw).toBeGreaterThan(0.25);
      expect(b.scale / a.scale).toBeGreaterThan(1.05);
    }
  });
  it('transients are unchanged: the first frame of a slam is the same oversize + blur as any other shot', () => {
    const p3 = plan(396, { focal: P3, aspect: A3, layout: 'cover', seed: 3 });
    const none = plan(396, { focal: null, seed: 3 });
    const a = shotFrameAt(p3, 0, at(P3, A3));
    const b = shotFrameAt(none, 0, null);
    expect(a.blurY).toBe(b.blurY);
    expect(a.scale / (WIDE_SCALE * holdMove('pushIn', 0, p3[0].moveScale, 0).m)).toBeCloseTo(b.scale / (WIDE_SCALE * holdMove(none[0].move, 0, none[0].moveScale, none[0].moveShift).m), 9);
  });
  it('single faces and no box never get an objectX (their frames are unchanged)', () => {
    for (const f of [null, person, { x: 0.654, y: 0.249, w: 0.261, h: 0.498 }]) {
      const shots = plan(396, { focal: f, seed: 1 });
      for (let k = 0; k < 396; k++) expect(shotFrameAt(shots, k, at(f)).objectX).toBeUndefined();
    }
  });
});
