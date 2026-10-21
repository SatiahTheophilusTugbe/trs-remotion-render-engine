import type { Beat, Focal } from '../types/beat';
import { photoLayout, smallPhotoSize } from './shots';

// Caption placement (owner 2026-10-20, live Oct 20 reel): the caption rose from bottom 640 into the lower
// part of a framed photo (letterbox / small card) and, on avatar beats, its two lines ran over the corner
// avatar. Now the caption HANGS from a top edge just below the beat's lowest photo frame, lines flowing
// down, and on avatar beats it wraps inside the space left of the avatar box.
export const FRAME_W = 1080;
export const FRAME_H = 1920;
/** Corner avatar box (AvatarBeat.tsx), bottom-right. */
export const AVATAR_BOX = { width: 320, height: 569 } as const;
/** Default caption top: just below a centred 16:9 frame (bottom 1264), the commonest framed photo. */
export const CAPTION_TOP = 1300;
export const CAPTION_GAP = 28;
/**
 * Lowest caption top. Two 60px lines from here end near y 1615, still above the platforms' bottom-left
 * caption overlay and inside the mobile feed preview (owner 2026-10-18). A taller card than that keeps
 * the caption over its lower edge.
 */
export const CAPTION_TOP_MAX = 1460;
export const CAPTION_SIDE = 60;
const AVATAR_CLEARANCE = 40;

type Photo = { photo_w?: number; photo_h?: number; focal?: Focal | null };

/** Bottom edge (px) of a framed photo: letterbox or small card, both centred. Full-bleed -> null. */
export const photoFrameBottom = (p: Photo): number | null => {
  const { photo_w: w, photo_h: h } = p;
  if (!w || !h) return null;
  const layout = photoLayout(p.focal ?? null, w / h, w, h);
  if (layout === 'small') return Math.round((FRAME_H + smallPhotoSize(w, h).height) / 2);
  if (layout === 'letterbox') return Math.round((FRAME_H + Math.min(FRAME_H, (FRAME_W * h) / w)) / 2);
  return null;
};

/** One placement per beat, so the caption never jumps between that beat's images. */
export const captionPlacement = (beat: Beat): { top: number; left: number; right: number } => {
  const photos: Photo[] = beat.visuals?.length ? beat.visuals : [beat];
  const bottoms = photos.map(photoFrameBottom).filter((b): b is number => b !== null);
  const lowest = bottoms.length ? Math.max(...bottoms) : null;
  const top = Math.min(CAPTION_TOP_MAX, Math.max(CAPTION_TOP, lowest === null ? 0 : lowest + CAPTION_GAP));
  const right = beat.type === 'avatar' ? AVATAR_BOX.width + AVATAR_CLEARANCE : CAPTION_SIDE;
  return { top, left: CAPTION_SIDE, right };
};

export const CAPTION_FONT = 60;
export const CAPTION_FONT_MIN = 44;
// Montserrat Bold averages ~0.62em per character; a single word never wraps, so the longest word on
// the page must fit the caption column (live Oct 20: "championship-winning" on an avatar beat).
const CHAR_EM = 0.62;
export const captionFontSize = (words: string[], columnWidth: number): number => {
  const longest = Math.max(1, ...words.map((w) => w.length));
  return Math.max(CAPTION_FONT_MIN, Math.min(CAPTION_FONT, Math.floor(columnWidth / (longest * CHAR_EM))));
};
