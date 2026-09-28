/* global console */
// Measures the rendered contact-sheet cells (out/grade-cells/element-NN.png, 1080x1920):
//   lime delta (graded vs G0 at every pixel that is exactly brand lime in G0), skin-tone hue/sat,
//   highlight clipping and shadow crushing. Writes out/grade-analysis.json and prints tables.
// Usage: node src/bakeoff/grade/analyze.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';

const W = 1080;
const H = 1920;
const files = readdirSync('out/grade-cells').filter((f) => f.endsWith('.png')).sort();
const GRADES = ['G0', 'G1', 'G2', 'G3', 'G4'];
const cellFile = (row, col) => `out/grade-cells/${files[row * 5 + col]}`;
const raw = (file) =>
  execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {
    maxBuffer: W * H * 3 + 1024,
  });

const ROW = { face: 0, bright: 1, dark: 2, avatarbox: 3, wipe: 4, skinMbappe: 5, skinArena: 6 };
const out = { lime: {}, skin: {}, tones: {} };

// ---- lime -------------------------------------------------------------------------------------
const LIMES = { wipePanel_or_caption_CCFF00: [204, 255, 0], badgeText_AAFF00: [170, 255, 0] };
for (const rowName of ['wipe', 'avatarbox']) {
  const base = raw(cellFile(ROW[rowName], 0));
  for (const name of Object.keys(LIMES)) {
    const [lr, lg, lb] = LIMES[name];
    const idx = [];
    for (let p = 0; p < W * H; p++) {
      if (base[p * 3] === lr && base[p * 3 + 1] === lg && base[p * 3 + 2] === lb) idx.push(p);
    }
    if (idx.length === 0) continue;
    const rec = { pixels: idx.length, perGrade: {} };
    for (let c = 1; c < 5; c++) {
      const g = raw(cellFile(ROW[rowName], c));
      let maxD = 0;
      let sum = 0;
      let changed = 0;
      for (const p of idx) {
        const d = Math.max(
          Math.abs(g[p * 3] - lr),
          Math.abs(g[p * 3 + 1] - lg),
          Math.abs(g[p * 3 + 2] - lb),
        );
        if (d > maxD) maxD = d;
        sum += d;
        if (d > 0) changed++;
      }
      rec.perGrade[GRADES[c]] = { maxChannelDelta: maxD, meanChannelDelta: +(sum / idx.length).toFixed(4), changedPixels: changed };
    }
    out.lime[`${rowName}:${name}`] = rec;
  }
}

// ---- lime if the WHOLE frame were graded (what we deliberately avoid) ---------------------------
try {
  const { GRADES: defs, toneCurve } = await import('./grades.ts');
  const sat = (r, g, b, s) => {
    const l = 0.213 * r + 0.715 * g + 0.072 * b;
    return [l + (r - l) * s, l + (g - l) * s, l + (b - l) * s];
  };
  out.limeIfGraded = {};
  for (const gr of defs) {
    if (gr.id === 'G0') continue;
    const [r, g, b] = sat(204 / 255, 1, 0, gr.saturation);
    const cl = (v) => Math.min(1, Math.max(0, v));
    const R = Math.round(255 * toneCurve(gr, 'r', cl(r)));
    const G = Math.round(255 * toneCurve(gr, 'g', cl(g)));
    const B = Math.round(255 * toneCurve(gr, 'b', cl(b)));
    out.limeIfGraded[gr.id] = [R, G, B];
  }
} catch (e) {
  out.limeIfGraded = `unavailable: ${e.message}`;
}

// ---- skin -------------------------------------------------------------------------------------
const BOXES = {
  face: ['Ballmer (light skin)', [[480, 590, 730, 680], [460, 750, 560, 840], [660, 750, 760, 840]]],
  skinMbappe: ['Mbappe (medium/brown skin)', [[760, 240, 960, 310], [690, 400, 780, 480], [930, 380, 1000, 460]]],
  skinArena: ['Arena player (dark skin)', [[790, 290, 980, 350], [795, 440, 850, 510], [960, 440, 1020, 520]]],
};
const hsv = (r, g, b) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: mx === 0 ? 0 : d / mx, v: mx };
};
for (const rowName of Object.keys(BOXES)) {
  const [label, boxes] = BOXES[rowName];
  out.skin[rowName] = { label, perGrade: {} };
  for (let c = 0; c < 5; c++) {
    const buf = raw(cellFile(ROW[rowName], c));
    let n = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (const [x0, y0, x1, y1] of boxes) {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = (y * W + x) * 3;
          sr += buf[p];
          sg += buf[p + 1];
          sb += buf[p + 2];
          n++;
        }
      }
    }
    const r = sr / n / 255;
    const g = sg / n / 255;
    const b = sb / n / 255;
    const { h, s, v } = hsv(r, g, b);
    // I/Q skin line (vectorscope): skin sits around ~123 degrees.
    const i = 0.596 * r - 0.274 * g - 0.322 * b;
    const q = 0.211 * r - 0.523 * g + 0.312 * b;
    out.skin[rowName].perGrade[GRADES[c]] = {
      rgb: [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)],
      hueDeg: +h.toFixed(1),
      satHSV: +s.toFixed(3),
      valueHSV: +v.toFixed(3),
      lumaRec709: +(0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(3),
      iqAngleDeg: +((Math.atan2(q, i) * 180) / Math.PI).toFixed(1),
    };
  }
}

// ---- clipping / crushing ----------------------------------------------------------------------
for (const rowName of ['face', 'bright', 'dark']) {
  out.tones[rowName] = {};
  for (let c = 0; c < 5; c++) {
    const buf = raw(cellFile(ROW[rowName], c));
    let clip = 0;
    let hi = 0;
    let crush = 0;
    let dark = 0;
    let lumSum = 0;
    const hist = new Array(256).fill(0);
    for (let p = 0; p < W * H; p++) {
      const r = buf[p * 3];
      const g = buf[p * 3 + 1];
      const b = buf[p * 3 + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      hist[Math.round(l)]++;
      lumSum += l;
      if (r >= 254 || g >= 254 || b >= 254) clip++;
      if (l >= 242) hi++;
      if (l <= 8) crush++;
      if (l <= 20) dark++;
    }
    const pct = (k) => {
      let a = 0;
      for (let v = 0; v < 256; v++) {
        a += hist[v];
        if (a >= k * W * H) return v;
      }
      return 255;
    };
    out.tones[rowName][GRADES[c]] = {
      pctAnyChannelClipped254: +((100 * clip) / (W * H)).toFixed(2),
      pctLumaAbove242: +((100 * hi) / (W * H)).toFixed(2),
      pctLumaBelow8: +((100 * crush) / (W * H)).toFixed(2),
      pctLumaBelow20: +((100 * dark) / (W * H)).toFixed(2),
      meanLuma: +(lumSum / (W * H)).toFixed(1),
      p1: pct(0.01),
      p50: pct(0.5),
      p99: pct(0.99),
    };
  }
}
writeFileSync('out/grade-analysis.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.lime, null, 1));
console.log('limeIfGraded', JSON.stringify(out.limeIfGraded));
for (const k of Object.keys(out.skin)) {
  console.log('SKIN', out.skin[k].label);
  for (const g of GRADES) console.log(' ', g, JSON.stringify(out.skin[k].perGrade[g]));
}
for (const k of Object.keys(out.tones)) {
  console.log('TONES', k);
  for (const g of GRADES) console.log(' ', g, JSON.stringify(out.tones[k][g]));
}
