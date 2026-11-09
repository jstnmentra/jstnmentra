// Turns an image into the ASCII art on the left of the card.
//
//   node scripts/portrait.mjs <image> [--cols=40] [--crop=x,y,w,h] [--invert] [--gamma=1.0]
//
// Writes assets/portrait.txt, which build.mjs reads. Bright pixels become dense
// characters, which is what you want on the dark card; --invert flips that for
// a photo on a bright background. Runs locally only (needs `sharp`), the
// GitHub Action never touches it.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    // Borrow it from a project that already has it installed.
    const from = process.env.SHARP_FROM ?? path.resolve(root, '..', 'resolvia', 'resolvia');
    return createRequire(path.join(from, 'package.json'))('sharp');
  }
}

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
if (!input) {
  console.error('usage: node scripts/portrait.mjs <image> [--cols=40] [--crop=x,y,w,h] [--invert] [--gamma=1.0]');
  process.exit(1);
}
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const cols = Number(opt('cols', 40));
const gamma = Number(opt('gamma', 1));
const invert = args.includes('--invert');
const crop = opt('crop', null)?.split(',').map(Number);

// A character cell is about 2.4 times taller than wide (14px font, 20px line).
const CELL_ASPECT = 2.4;
const RAMP = ' .:-=+*#%@';

const sharp = await loadSharp();
let img = sharp(input);
if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
const cropped = await img.png().toBuffer();
const meta = await sharp(cropped).metadata();
const rows = Math.max(1, Math.round((cols * meta.height) / meta.width / CELL_ASPECT));

const { data } = await sharp(cropped)
  .flatten({ background: '#000000' })
  .greyscale()
  .normalise()
  .resize(cols, rows, { fit: 'fill' })
  .raw()
  .toBuffer({ resolveWithObject: true });

const lines = [];
for (let y = 0; y < rows; y++) {
  let line = '';
  for (let x = 0; x < cols; x++) {
    let v = data[y * cols + x] / 255;
    if (invert) v = 1 - v;
    v = Math.pow(v, gamma);
    line += RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))];
  }
  lines.push(line.replace(/\s+$/, ''));
}

fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets', 'portrait.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`\n${cols}x${rows} -> assets/portrait.txt`);
