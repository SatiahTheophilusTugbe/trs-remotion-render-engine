import { AbsoluteFill, Img } from 'remotion';
import type { CameraFrame } from '../lib/camera';
import { PhotoGrade } from './PhotoGrade';

export const BeatBackground: React.FC<{
  photoUrl: string | null | undefined;
  objectPosition: string;
  camera?: CameraFrame;
  /**
   * @deprecated Superseded by `camera`. Retained only so the src/bakeoff/ prototype
   * tooling (out of scope for this task) keeps compiling/rendering unchanged.
   */
  scale?: number;
}> = ({ photoUrl, objectPosition, camera, scale }) => {
  if (!photoUrl) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#0a0a0a',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            color: '#222',
            fontSize: 420,
            fontWeight: 900,
            fontFamily: 'Arial, sans-serif',
            opacity: 0.5,
          }}
        >
          TRS
        </p>
      </AbsoluteFill>
    );
  }
  return (
    <PhotoGrade>
      <Img
        src={photoUrl}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition,
          transform: camera
            ? `translate(${camera.translateXPct}%, ${camera.translateYPct}%) scale(${camera.scale})`
            : scale !== undefined
              ? `scale(${scale})`
              : undefined,
        }}
      />
    </PhotoGrade>
  );
};
