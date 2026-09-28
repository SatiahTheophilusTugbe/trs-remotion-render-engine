/* global console, process */
// Assembles the contact sheet from out/grade-cells/element-NN.png (ffmpeg only, no extra deps).
// Rows = test frames, columns = G0..G4. Usage: node src/bakeoff/grade/make-sheet.mjs [out.png] [rowIdx,rowIdx,...]
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';

const OUT = process.argv[2] ?? 'out/grade-sheet.png';
const ROW_SEL = (process.argv[3] ?? '0,1,2,3').split(',').map(Number);
const ROWS = [
  'Row 1 - portrait face (Ballmer)',
  'Row 2 - white jersey / bright - synthetic +35 pct exposure (highlight clipping check)',
  'Row 3 - dark arena - synthetic -40 pct exposure (shadow crushing check)',
  'Row 4 - avatar box + badges + glass banner + captions',
  'Row 5 - lime wipe + badges + captions (lime test)',
  'Row 6 - skin medium (unshifted)',
  'Row 7 - skin dark (unshifted)',
];
const COLS = ['G0  NO GRADE', 'G1  BROADCAST NOIR', 'G2  FLOODLIGHT', 'G3  GREEN-BLACK', 'G4  MATTE EDITORIAL'];
const FONT = 'C' + String.fromCharCode(92) + ':/Windows/Fonts/arialbd.ttf';
const CW = 324;
const CH = 576;
const BAND = 34;
const tmp = 'out/grade-sheet-tmp';
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const files = readdirSync('out/grade-cells').filter((f) => f.endsWith('.png')).sort();
const rowFiles = [];
for (const r of ROW_SEL) {
  const args = ['-y', '-v', 'error'];
  for (let c = 0; c < 5; c++) args.push('-i', `out/grade-cells/${files[r * 5 + c]}`);
  const parts = [];
  for (let c = 0; c < 5; c++) {
    parts.push(
      `[${c}:v]scale=${CW}:${CH},pad=${CW}:${CH + BAND}:0:${BAND}:color=0x101010,drawtext=fontfile='${FONT}':text='${COLS[c]}':x=8:y=9:fontsize=17:fontcolor=white[c${c}]`,
    );
  }
  const fc = `${parts.join(';')};[c0][c1][c2][c3][c4]hstack=inputs=5,pad=iw+4:ih+${BAND}:2:${BAND}:color=0x1c1c1c,drawtext=fontfile='${FONT}':text='${ROWS[r]}':x=10:y=8:fontsize=20:fontcolor=0xCCFF00[out]`;
  const f = `${tmp}/row${r}.png`;
  args.push('-filter_complex', fc, '-map', '[out]', '-frames:v', '1', f);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  rowFiles.push(f);
}
const args = ['-y', '-v', 'error'];
for (const f of rowFiles) args.push('-i', f);
args.push('-filter_complex', `${rowFiles.map((_, i) => `[${i}:v]`).join('')}vstack=inputs=${rowFiles.length}[out]`, '-map', '[out]', '-frames:v', '1', OUT);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
rmSync(tmp, { recursive: true, force: true });
console.log('wrote', OUT);
