import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AvatarBeatData } from '../types/beat';
import { BeatBackground } from './BeatBackground';
import { PhotoGrade } from './PhotoGrade';
import { cameraFrameAt, type CameraMoveName } from '../lib/camera';
import { framesForBeat } from '../lib/duration';

export const AvatarBeat: React.FC<{
  beat: AvatarBeatData;
  /**
   * Defaults to 'zoomIn' so src/bakeoff/ prototypes that render this component directly
   * (out of scope for this task) keep working without threading a camera assignment through.
   */
  cameraMove?: CameraMoveName;
}> = ({ beat, cameraMove = 'zoomIn' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = framesForBeat(beat, fps);
  const camera = cameraFrameAt(cameraMove, frame, durationInFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <BeatBackground photoUrl={beat.photo_url} objectPosition="center top" camera={camera} />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 320,
          height: 569,
          border: '2px solid #CCFF00',
          borderRadius: '12px 0 0 0',
          overflow: 'hidden',
          WebkitMaskImage:
            'linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.35) 8%, #000 22%, #000 100%)',
          maskImage:
            'linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.35) 8%, #000 22%, #000 100%)',
        }}
      >
        <PhotoGrade width={320} vignette={false}>
          <OffthreadVideo
            src={beat.clip_url}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </PhotoGrade>
      </div>
    </AbsoluteFill>
  );
};
