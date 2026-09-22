import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';

export type TrivialBeat = {
  overlay_text: string;
  duration_sec: number;
  beat_index: number;
};

export const TrivialBeatDemo: React.FC<{ beats: TrivialBeat[]; fps: number }> = ({
  beats,
  fps,
}) => {
  let frameCursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#0B0B0B' }}>
      {beats.map((beat) => {
        const durationInFrames = Math.round(beat.duration_sec * fps);
        const from = frameCursor;
        frameCursor += durationInFrames;
        return (
          <Sequence key={beat.beat_index} from={from} durationInFrames={durationInFrames}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                color: '#CCFF00',
                fontFamily: 'sans-serif',
                fontSize: 64,
                textAlign: 'center',
                padding: 40,
              }}
            >
              {`Beat ${beat.beat_index}: ${beat.overlay_text}`}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
