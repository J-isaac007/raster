import { alpha, blue, green, red, TRANSPARENT, type Color } from './color';
import type { PixelPatch } from './history';
import { MAX_PALETTE_COLORS } from './paletteFormats';
import { builtinPalette } from './palettes';

/** A new sprite's palette: PICO-8 (see core/palettes.ts for the rest). */
export const DEFAULT_PALETTE: Color[] = [...builtinPalette('pico-8')!.colors];

// Palette files are read and written in core/paletteFormats.ts.

/** `current` plus each color of `added` it doesn't have yet, at most `max` colors. */
export function mergePalettes(
  current: readonly Color[],
  added: readonly Color[],
  max = MAX_PALETTE_COLORS,
): Color[] {
  const out = [...current];
  const seen = new Set(current);
  for (const c of added) {
    if (out.length >= max) break;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
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
