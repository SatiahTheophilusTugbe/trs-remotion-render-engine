import { describe, it, expect } from 'vitest';
import {
  CAMERA_MOVES,
  cameraFrameAt,
  assignCameraMoves,
  type CameraMoveName,
} from './camera';

const MOVE_NAMES: CameraMoveName[] = [
  'zoomIn',
  'zoomOut',
  'panLeft',
  'panRight',
  'panUp',
  'panDown',
];

const SAMPLE_TS = Array.from({ length: 21 }, (_, i) => i / 20); // 0, 0.05, ..., 1

describe('CAMERA_MOVES', () => {
  it('has all 6 required moves', () => {
    expect(Object.keys(CAMERA_MOVES).sort()).toEqual([...MOVE_NAMES].sort());
  });

  it('never reveals empty space at any sampled t for any move (scale >= 1, pan within overflow budget)', () => {
    for (const name of MOVE_NAMES) {
      for (const t of SAMPLE_TS) {
        const frame = CAMERA_MOVES[name](t);
        expect(frame.scale).toBeGreaterThanOrEqual(1);
        const maxOffset = (frame.scale - 1) * 50;
        expect(Math.abs(frame.translateXPct)).toBeLessThanOrEqual(maxOffset + 1e-9);
        expect(Math.abs(frame.translateYPct)).toBeLessThanOrEqual(maxOffset + 1e-9);
      }
    }
  });

  it('zoomIn and zoomOut are pure scale (no translation) at every sampled t', () => {
    for (const t of SAMPLE_TS) {
      const zoomIn = CAMERA_MOVES.zoomIn(t);
      expect(zoomIn.translateXPct).toBe(0);
      expect(zoomIn.translateYPct).toBe(0);

      const zoomOut = CAMERA_MOVES.zoomOut(t);
      expect(zoomOut.translateXPct).toBe(0);
      expect(zoomOut.translateYPct).toBe(0);
    }
  });

  it('zoomIn scale increases monotonically from ~1.0 to >1.0 across every sampled t', () => {
    let prevScale = -Infinity;
    for (const t of SAMPLE_TS) {
      const { scale } = CAMERA_MOVES.zoomIn(t);
      expect(scale).toBeGreaterThanOrEqual(prevScale);
      prevScale = scale;
    }
    expect(CAMERA_MOVES.zoomIn(0).scale).toBeCloseTo(1.0);
    expect(CAMERA_MOVES.zoomIn(1).scale).toBeGreaterThan(1.0);
  });

  it('zoomOut scale decreases monotonically across every sampled t, ending at 1.0', () => {
    let prevScale = Infinity;
    for (const t of SAMPLE_TS) {
      const { scale } = CAMERA_MOVES.zoomOut(t);
      expect(scale).toBeLessThanOrEqual(prevScale);
      prevScale = scale;
    }
    expect(CAMERA_MOVES.zoomOut(0).scale).toBeGreaterThan(1.0);
    expect(CAMERA_MOVES.zoomOut(1).scale).toBeCloseTo(1.0);
  });

  describe.each([
    ['panLeft', 'translateXPct', 'decrease'] as const,
    ['panRight', 'translateXPct', 'increase'] as const,
    ['panUp', 'translateYPct', 'decrease'] as const,
    ['panDown', 'translateYPct', 'increase'] as const,
  ])('%s', (name, axis, direction) => {
    it(`holds scale constant across every sampled t`, () => {
      const scales = SAMPLE_TS.map((t) => CAMERA_MOVES[name as CameraMoveName](t).scale);
      const first = scales[0];
      for (const scale of scales) {
        expect(scale).toBeCloseTo(first, 5);
      }
      expect(first).toBeGreaterThanOrEqual(1);
    });

    it(`moves only along its own axis`, () => {
      const otherAxis = axis === 'translateXPct' ? 'translateYPct' : 'translateXPct';
      for (const t of SAMPLE_TS) {
        const frame = CAMERA_MOVES[name as CameraMoveName](t);
        expect(frame[otherAxis]).toBe(0);
      }
    });

    it(`moves monotonically in the ${direction} direction along its axis across every sampled t`, () => {
      const values = SAMPLE_TS.map((t) => CAMERA_MOVES[name as CameraMoveName](t)[axis]);
      for (let i = 1; i < values.length; i += 1) {
        if (direction === 'decrease') {
          expect(values[i]).toBeLessThanOrEqual(values[i - 1] + 1e-9);
        } else {
          expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] - 1e-9);
        }
      }
      // and it actually moves (not flat)
      expect(values[values.length - 1]).not.toBeCloseTo(values[0], 5);
    });
  });
});

describe('cameraFrameAt', () => {
  const DURATION = 90;

  it('matches CAMERA_MOVES at t=0 for frame 0', () => {
    for (const name of MOVE_NAMES) {
      expect(cameraFrameAt(name, 0, DURATION)).toEqual(CAMERA_MOVES[name](0));
    }
  });

  it('matches CAMERA_MOVES at t=1 for frame === durationInFrames', () => {
    for (const name of MOVE_NAMES) {
      expect(cameraFrameAt(name, DURATION, DURATION)).toEqual(CAMERA_MOVES[name](1));
    }
  });

  it('matches CAMERA_MOVES for every in-range sampled frame', () => {
    for (const name of MOVE_NAMES) {
      for (const t of SAMPLE_TS) {
        const frame = Math.round(t * DURATION);
        expect(cameraFrameAt(name, frame, DURATION)).toEqual(
          CAMERA_MOVES[name](frame / DURATION),
        );
      }
    }
  });

  it('clamps frame < 0 to behave like t=0', () => {
    for (const name of MOVE_NAMES) {
      expect(cameraFrameAt(name, -10, DURATION)).toEqual(CAMERA_MOVES[name](0));
      expect(cameraFrameAt(name, -1000, DURATION)).toEqual(CAMERA_MOVES[name](0));
    }
  });

  it('clamps frame > durationInFrames to behave like t=1', () => {
    for (const name of MOVE_NAMES) {
      expect(cameraFrameAt(name, DURATION + 1, DURATION)).toEqual(CAMERA_MOVES[name](1));
      expect(cameraFrameAt(name, DURATION + 500, DURATION)).toEqual(CAMERA_MOVES[name](1));
    }
  });

  it('handles durationInFrames <= 0 without throwing, behaving like t=0', () => {
    for (const name of MOVE_NAMES) {
      expect(cameraFrameAt(name, 5, 0)).toEqual(CAMERA_MOVES[name](0));
    }
  });
});

describe('assignCameraMoves', () => {
  const stubBeats = (n: number) => Array.from({ length: n }, () => ({ duration_sec: 4 }));

  it.each([0, 1, 2, 3, 8, 20])('returns %i entries for %i beats', (n) => {
    const result = assignCameraMoves(stubBeats(n));
    expect(result).toHaveLength(n);
  });

  it.each([0, 1, 2, 3, 8, 20])('every entry is a valid CameraMoveName (length %i)', (n) => {
    const result = assignCameraMoves(stubBeats(n));
    for (const move of result) {
      expect(MOVE_NAMES).toContain(move);
    }
  });

  it.each([2, 3, 8, 20])('no two adjacent entries are equal (length %i)', (n) => {
    const result = assignCameraMoves(stubBeats(n));
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i]).not.toBe(result[i - 1]);
    }
  });

  it.each([0, 1, 2, 3, 8, 20])('is deterministic across repeated calls (length %i)', (n) => {
    const beats = stubBeats(n);
    const first = assignCameraMoves(beats);
    const second = assignCameraMoves(beats);
    expect(second).toEqual(first);
  });

  it('is not a constant sequence across different lengths (sanity check)', () => {
    const lengths = [3, 8, 20];
    const results = lengths.map((n) => assignCameraMoves(stubBeats(n)));
    const allSame = results.every(
      (result) => JSON.stringify(result.slice(0, 3)) === JSON.stringify(results[0].slice(0, 3)),
    );
    // At least the assignment must vary somewhere across these runs/lengths —
    // it must not be hard-coded to a single fixed rotation regardless of index.
    const flatValues = new Set(results.flat());
    expect(flatValues.size).toBeGreaterThan(1);
    expect(allSame && flatValues.size <= 1).toBe(false);
  });
});
