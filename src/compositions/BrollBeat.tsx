import { AbsoluteFill, Audio, useCurrentFrame } from 'remotion';
import type { BrollBeatData } from '../types/beat';
import { cameraFrameAt, type CameraMoveName } from '../lib/camera';
import { framesForBeat } from '../lib/duration';
import { BeatBackground } from './BeatBackground';

export const BrollBeat: React.FC<{
  beat: BrollBeatData;
  fps: number;
  /**
   * Defaults to 'zoomIn' so src/bakeoff/ prototypes that render this component directly
   * (out of scope for this task) keep working without threading a camera assignment through.
   */
  cameraMove?: CameraMoveName;
}> = ({ beat, fps, cameraMove = 'zoomIn' }) => {
  const frame = useCurrentFrame();
  const durationInFrames = framesForBeat(beat, fps);
  const camera = cameraFrameAt(cameraMove, frame, durationInFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground photoUrl={beat.photo_url} objectPosition="center top" camera={camera} />
      {beat.audio_url ? <Audio src={beat.audio_url} /> : null}
    </AbsoluteFill>
  );
};
