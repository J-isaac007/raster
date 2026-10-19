import { alpha, blue, fromHex, green, red, rgba, toHex, TRANSPARENT, type Color } from './color';
import type { PixelPatch } from './history';

export interface PalettePreset {
  name: string;
  colors: Color[];
}

const hexList = (list: string) => list.split(/\s+/).map((h) => fromHex(h)!);

export const PRESETS: PalettePreset[] = [
  {
    name: 'PICO-8',
    colors: hexList(
      '000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa',
    ),
  },
  {
    name: 'Game Boy',
    colors: hexList('0f380f 306230 8bac0f 9bbc0f'),
  },
  {
    name: 'Grayscale',
    colors: Array.from({ length: 8 }, (_, i) => {
      const v = Math.round((i / 7) * 255);
      return rgba(v, v, v);
    }),
  },
];

export const DEFAULT_PALETTE: Color[] = PRESETS[0].colors;

/**
 * Parses a palette file. Supports plain hex lists (`.hex`, as used by Lospec)
 * and GIMP palettes (`.gpl`). Unknown lines are skipped.
 */
export function parsePalette(text: string): Color[] {
  const colors: Color[] = [];
  const isGpl = text.trimStart().startsWith('GIMP Palette');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) {
      // `#` starts a comment in .gpl but may also start a hex color.
      if (!isGpl && /^#[0-9a-f]{3,8}$/i.test(line)) colors.push(fromHex(line)!);
      continue;
    }
    if (isGpl) {
      const m = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\b/.exec(line);
      if (m) colors.push(rgba(+m[1], +m[2], +m[3]));
    } else {
      const c = fromHex(line.split(/\s+/)[0]);
      if (c !== null) colors.push(c);
    }
  }
  return colors;
}

/** Serializes to the `.hex` format: one `rrggbb` (or `rrggbbaa`) per line. */
export function formatHexPalette(colors: Color[]): string {
  return colors.map((c) => toHex(c).slice(1)).join('\n') + '\n';
}

// ---- indexed color ------------------------------------------------------------

/**
 * The palette color closest to `c` (squared RGBA distance). Fully transparent
 * pixels stay `TRANSPARENT`, and so does everything when the palette is empty.
 */
export function nearestColor(c: Color, palette: readonly Color[]): Color {
  if (alpha(c) === 0 || palette.length === 0) return TRANSPARENT;
  let best = palette[0];
  let bestDist = Infinity;
  for (const p of palette) {
    const dr = red(c) - red(p);
    const dg = green(c) - green(p);
    const db = blue(c) - blue(p);
    const da = alpha(c) - alpha(p);
    const dist = dr * dr + dg * dg + db * db + da * da;
    if (dist < bestDist) {
      best = p;
      bestDist = dist;
      if (dist === 0) break;
    }
  }
  return best;
}

/** A cached `nearestColor` for snapping many pixels to one palette. */
export function paletteSnapper(palette: readonly Color[]): (c: Color) => Color {
  const cache = new Map<Color, Color>();
  return (c) => {
    let out = cache.get(c);
    if (out === undefined) {
      out = nearestColor(c, palette);
      cache.set(c, out);
    }
    return out;
  };
}

/**
 * How indexed pixels follow a palette change. Pixels act as palette indices:
 * when the palette keeps its size, entry i's pixels take the new entry i (a
 * palette swap). Otherwise colors still in the palette stay and the rest snap
 * to the nearest new color.
 */
export function paletteRemap(
  before: readonly Color[],
  after: readonly Color[],
): (c: Color) => Color {
  const snap = paletteSnapper(after);
  const keep = new Set(after);
  if (before.length !== after.length) return (c) => (keep.has(c) ? c : snap(c));
  return (c) => {
    if (alpha(c) === 0) return TRANSPARENT;
    const i = before.indexOf(c);
    return i >= 0 ? after[i] : keep.has(c) ? c : snap(c);
  };
}

/** Maps every pixel through `fn` in place. Returns the changes, or null if none. */
export function recolorPixels(pixels: Uint32Array, fn: (c: Color) => Color): PixelPatch | null {
  const indices: number[] = [];
  const before: number[] = [];
  const after: number[] = [];
  for (let i = 0; i < pixels.length; i++) {
    const c = pixels[i];
    const out = fn(c);
    if (out === c) continue;
    indices.push(i);
    before.push(c);
    after.push(out);
    pixels[i] = out;
  }
  if (indices.length === 0) return null;
  return {
    indices: Uint32Array.from(indices),
    before: Uint32Array.from(before),
    after: Uint32Array.from(after),
  };
}
