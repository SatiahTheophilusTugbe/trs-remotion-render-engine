import { AbsoluteFill } from 'remotion';
import { montserratBold } from '../lib/fonts';

const badgeBox = {
  display: 'inline-block',
  padding: '12px 22px',
  background: 'rgba(0,0,0,0.4)',
  borderRadius: 6,
  whiteSpace: 'nowrap',
} as const;

const badgeText = {
  margin: 0,
  color: '#AAFF00',
  fontFamily: montserratBold,
  fontSize: 30,
  fontWeight: 700,
  letterSpacing: '2px',
  textShadow: '0 2px 10px rgba(0,0,0,0.95)',
} as const;

export const BrandBadges: React.FC<{ leagueBadge?: string | null }> = ({ leagueBadge }) => (
  <AbsoluteFill>
    <div style={{ position: 'absolute', top: 0, left: 0 }}>
      <div style={badgeBox}>
        <p style={badgeText}>THIRD RAIL SPORTS</p>
      </div>
    </div>
    {leagueBadge ? (
      <div style={{ position: 'absolute', top: 0, right: 0 }}>
        <div style={badgeBox}>
          <p style={badgeText}>{leagueBadge}</p>
        </div>
      </div>
    ) : null}
  </AbsoluteFill>
);
