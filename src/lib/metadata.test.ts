import { describe, it, expect } from 'vitest';
import { compositionMetadata } from './metadata';

describe('compositionMetadata', () => {
  const beats = [{ duration_sec: 5 }, { duration_sec: 4 }];

  it('returns the frame count and the fps it was computed with (30fps)', () => {
    expect(compositionMetadata(beats, 30)).toEqual({ durationInFrames: 270, fps: 30 });
  });

  it('returns the requested fps, not a hard-coded one (25fps -> 225 frames = still 9s)', () => {
    expect(compositionMetadata(beats, 25)).toEqual({ durationInFrames: 225, fps: 25 });
  });
});
