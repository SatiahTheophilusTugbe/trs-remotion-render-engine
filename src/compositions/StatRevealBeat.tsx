import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig } from 'remotion';
import type { StatBeatData } from '../types/beat';
import { BeatBackground } from './BeatBackground';
import { OdometerStat } from './OdometerStat';
import { cameraFrameAt, type CameraMoveName } from '../lib/camera';
import { framesForBeat } from '../lib/duration';

export const StatRevealBeat: React.FC<{
  beat: StatBeatData;
  /**
   * Defaults to 'zoomIn' so src/bakeoff/ prototypes that render this component directly
   * (out of scope for this task) keep working without threading a camera assignment through.
   */
  cameraMove?: CameraMoveName;
}> = ({ beat, cameraMove = 'zoomIn' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = framesForBeat(beat, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground
        photoUrl={beat.photo_url}
        objectPosition="center top"
        camera={cameraFrameAt(cameraMove, frame, durationInFrames)}
      />
      <OdometerStat stat={beat.stat} />
      {beat.audio_url ? <Audio src={beat.audio_url} /> : null}
    </AbsoluteFill>
  );
};
