// Renders the Raster mark (src/brand/logo.json) to every brand asset:
// the app icon (build/icon.png) and the README lockups.
// Run with `node scripts/generate-icons.mjs` after changing the logo.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const logo = JSON.parse(readFileSync('src/brand/logo.json', 'utf8'));
const N = logo.size;

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const BG = hexRgb(logo.background);
const COLORS = Object.fromEntries(Object.entries(logo.colors).map(([k, v]) => [k, hexRgb(v)]));

// ---- SVG ----------------------------------------------------------------------

/** Merges each row's same-colored pixels into runs, one <rect> per run. */
function runs(rows, colorOf, ox = 0, oy = 0) {
  const out = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const key = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === key) end++;
      const fill = colorOf(key);
      if (fill) {
        out.push(
          `<rect x="${x + ox}" y="${y + oy}" width="${end - x}" height="1" fill="${fill}"/>`,
        );
      }
      x = end;
    }
  });
  return out.join('');
}

const markSvg = (ox = 0, oy = 0) =>
  `<rect x="${ox}" y="${oy}" width="${N}" height="${N}" rx="${logo.radius}" fill="${logo.background}"/>` +
  runs(logo.pixels, (k) => logo.colors[k], ox, oy);

// 5×7 pixel wordmark.
const GLYPHS = {
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
};

function lockup(textColor) {
  // The mark is 10 units tall; the wordmark is 7 units, scaled to sit beside it.
  const rows = Array.from({ length: 7 }, () => '');
  for (const ch of 'Raster') {
    GLYPHS[ch].forEach((g, y) => (rows[y] += g + '.'));
  }
  const textW = rows[0].length - 1;
  const scale = 6 / 7; // wordmark height: 6 units
  const gap = 3;
  const width = N + gap + textW * scale;
  const text = runs(rows, (k) => (k === '#' ? textColor : null));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${N}" width="${width * 12}" height="${N * 12}" shape-rendering="crispEdges">` +
    `<title>Raster</title>${markSvg()}` +
    `<g transform="translate(${N + gap} 2) scale(${scale})">${text}</g></svg>\n`
  );
}

// ---- PNG ----------------------------------------------------------------------

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Encodes an RGBA image; `rgbaAt(x, y)` returns [r, g, b, a]. */
function png(size, rgbaAt) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) raw.set(rgbaAt(x, y), y * stride + 1 + x * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Coverage (0..1) of pixel (x, y) by a rounded square of side `size`, radius `r`. */
function roundedCoverage(x, y, size, r) {
  let hits = 0;
  for (let sy = 0; sy < 4; sy++) {
    for (let sx = 0; sx < 4; sx++) {
      const px = x + (sx + 0.5) / 4;
      const py = y + (sy + 0.5) / 4;
      const cx = Math.min(Math.max(px, r), size - r);
      const cy = Math.min(Math.max(py, r), size - r);
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) hits++;
    }
  }
  return hits / 16;
}

/**
 * Renders the mark at `size` px. Pixel art snaps to whole-pixel cells so it
 * stays crisp. `inset` is the fraction of each side reserved as background
 * (maskable icons need their art inside a central safe zone). `fullBleed`
 * fills the square edge to edge, for platforms that round corners themselves.
 */
function renderPng(size, { inset = 0, fullBleed = false } = {}) {
  const cell = Math.floor((size * (1 - 2 * inset)) / N);
  const offset = Math.round((size - cell * N) / 2);
  const radius = (logo.radius / N) * size;
  return png(size, (x, y) => {
    const a = fullBleed ? 1 : roundedCoverage(x, y, size, radius);
    if (a === 0) return [0, 0, 0, 0];
    const gx = Math.floor((x - offset) / cell);
    const gy = Math.floor((y - offset) / cell);
    const key = logo.pixels[gy]?.[gx];
    const rgb = (key && COLORS[key]) || BG;
    return [...rgb, Math.round(a * 255)];
  });
}

mkdirSync('build', { recursive: true });
// electron-builder turns this into the Windows .ico and the window icon.
writeFileSync('build/icon.png', renderPng(512));
writeFileSync('docs/logo-light.svg', lockup('#16171d'));
writeFileSync('docs/logo-dark.svg', lockup('#f4f5f8'));
console.log('Wrote build/icon.png and README logos.');
