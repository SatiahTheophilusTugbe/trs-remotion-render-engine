// src/compositions/Thumbnail.tsx
import { AbsoluteFill, Img } from 'remotion';
import { PhotoGrade } from './PhotoGrade';
import { montserratBold } from '../lib/fonts';
import { focalObjectPosition, safeCropScale } from '../lib/shots';
import { BAND_TOP, LIME, fitFontSize, thumbLayout, type ThumbnailProps } from '../lib/thumbnail';

const text = { fontFamily: montserratBold, fontWeight: 700, margin: 0, lineHeight: 1.02, whiteSpace: 'nowrap', WebkitTextStroke: '4px rgba(0,0,0,0.85)', paintOrder: 'stroke fill' } as const;

export const Thumbnail: React.FC<ThumbnailProps> = ({ photo_url, focal, photo_w, photo_h, line1, line2, stat }) => {
  const aspect = photo_w && photo_h ? photo_w / photo_h : null;
  const scale = Math.min(1.2, safeCropScale(focal, aspect) ?? 1); // zoom in on the face, never past the subject box
  const origin = focal ? `${focal.x * 100}% ${focal.y * 100}%` : '50% 30%';
  const layout = thumbLayout(stat);
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <PhotoGrade>
        <Img
          src={photo_url}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: focalObjectPosition(focal), transform: `scale(${scale})`, transformOrigin: origin }}
        />
      </PhotoGrade>
      {/* No brand or league labels on the cover (owner, 2026-10-05: cleaner). */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: BAND_TOP, padding: '36px 60px 40px', backgroundColor: 'rgba(0,0,0,0.72)' }}>
        {layout === 'B' && stat ? (
          <>
            <p style={{ ...text, color: LIME, fontSize: fitFontSize(stat.value, 960, 300, 160) }}>{stat.value}</p>
            <p style={{ ...text, color: '#FFFFFF', fontSize: fitFontSize(stat.label, 960, 76, 48), marginTop: 12 }}>{stat.label}</p>
          </>
        ) : (
          <>
            <p style={{ ...text, color: '#FFFFFF', fontSize: fitFontSize(line1, 960, 150, 60) }}>{line1}</p>
            {line2 ? <p style={{ ...text, color: LIME, fontSize: fitFontSize(line2, 960, 150, 60), marginTop: 8 }}>{line2}</p> : null}
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
