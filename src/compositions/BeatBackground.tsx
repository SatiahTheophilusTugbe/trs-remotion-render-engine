import { AbsoluteFill, Img } from 'remotion';

export const BeatBackground: React.FC<{
  photoUrl: string | null | undefined;
  objectPosition: string;
  scale?: number;
}> = ({ photoUrl, objectPosition, scale = 1 }) => {
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
        transform: `scale(${scale})`,
      }}
    />
  );
};
