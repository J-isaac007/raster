// Color adjustments and effects (the Adjust menu). Each takes a surface and
// returns new pixels of the same size, leaving the input untouched. Fully
// transparent pixels stay as they are, except where an effect (outline, drop
// shadow) paints new ones.
import { alpha, blue, fromHsl, green, red, rgba, toHsl, type Color } from './color';
import type { Surface } from './sprite';

const opaque = (c: Color) => c >>> 24 !== 0;

/** Maps every pixel that isn't fully transparent through `fn`. */
function mapPixels(src: Surface, fn: (c: Color) => Color): Uint32Array {
  const out = src.pixels.slice();
  for (let i = 0; i < out.length; i++) if (opaque(out[i])) out[i] = fn(out[i]);
  return out;
}

/** Moves `v` (0..1) toward 0 (`k` < 0) or 1 (`k` > 0); `k` runs -1..1. */
const shift = (v: number, k: number) => (k < 0 ? v * (1 + k) : v + (1 - v) * k);

/**
 * Shifts hue by `dh` degrees (-180..180) and saturation and lightness by `ds`
 * and `dl` (-100..100). -100 lightness is black and 100 white; -100
 * saturation is gray, and 100 is full saturation for any pixel with some color
 * (grays stay gray).
 */
export function hueSaturation(src: Surface, dh: number, ds: number, dl: number): Uint32Array {
  if (dh === 0 && ds === 0 && dl === 0) return src.pixels.slice();
  const ks = Math.max(-1, Math.min(1, ds / 100));
  const kl = Math.max(-1, Math.min(1, dl / 100));
  return mapPixels(src, (c) => {
    const [h, s, l] = toHsl(c);
    const sat = ks < 0 ? s * (1 + ks) : s === 0 ? 0 : s ** (1 - ks);
    return fromHsl(h + dh / 360, sat, shift(l, kl), alpha(c));
  });
}

/** Inverts red, green and blue; alpha stays. */
export function invert(src: Surface): Uint32Array {
  return mapPixels(src, (c) => rgba(255 - red(c), 255 - green(c), 255 - blue(c), alpha(c)));
}

/** Turns every pixel gray by its luminance (Rec. 709 weights); alpha stays. */
export function desaturate(src: Surface): Uint32Array {
  return mapPixels(src, (c) => {
    const v = Math.round(0.2126 * red(c) + 0.7152 * green(c) + 0.0722 * blue(c));
    return rgba(v, v, v, alpha(c));
  });
}

/**
 * Replaces `from` with `to`, along with every pixel whose red, green, blue
 * and alpha are each within `tolerance` (0..255) of it. 0 matches only the
 * exact color.
 */
export function replaceColor(src: Surface, from: Color, to: Color, tolerance: number): Uint32Array {
  const near = (a: number, b: number) => Math.abs(a - b) <= tolerance;
  return mapPixels(src, (c) =>
    near(red(c), red(from)) &&
    near(green(c), green(from)) &&
    near(blue(c), blue(from)) &&
    near(alpha(c), alpha(from))
      ? to
      : c,
  );
}

export interface OutlineOptions {
  /** `outside` paints the transparent pixels around the art; `inside` recolors its edge pixels. */
  place: 'outside' | 'inside';
  /** Counts diagonal neighbors too, for corners filled in. */
  diagonals: boolean;
}

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const CORNERS = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
] as const;

/**
 * Draws a one-pixel outline in `color` around the art (its pixels that
 * aren't fully transparent). Pixels past the surface's edges count as
 * transparent.
 */
export function outline(src: Surface, color: Color, options: OutlineOptions): Uint32Array {
  const { width: w, height: h, pixels } = src;
  const out = pixels.slice();
  const dirs = options.diagonals ? [...SIDES, ...CORNERS] : SIDES;
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && opaque(pixels[y * w + x]);
  const inside = options.place === 'inside';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Outside: an empty pixel next to art. Inside: art next to an empty pixel.
      if (solid(x, y) !== inside) continue;
      if (dirs.some(([dx, dy]) => solid(x + dx, y + dy) !== inside)) out[y * w + x] = color;
    }
  }
  return out;
}

/**
 * Casts the art's shadow in `color`, offset by (dx, dy). The shadow only
 * fills fully transparent pixels, so it never covers the art.
 */
export function dropShadow(src: Surface, color: Color, dx: number, dy: number): Uint32Array {
  const { width: w, height: h, pixels } = src;
  const out = pixels.slice();
  for (let y = 0; y < h; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < w; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= w) continue;
      const i = y * w + x;
      if (!opaque(pixels[i]) && opaque(pixels[sy * w + sx])) out[i] = color;
    }
  }
  return out;
}

/** One Adjust menu item with its settings. */
export type Adjustment =
  | { kind: 'hueSaturation'; hue: number; saturation: number; lightness: number }
  | { kind: 'replaceColor'; from: Color; to: Color; tolerance: number }
  | { kind: 'invert' }
  | { kind: 'desaturate' }
  | ({ kind: 'outline'; color: Color } & OutlineOptions)
  | { kind: 'dropShadow'; color: Color; dx: number; dy: number };

/** Undo labels, which match the menu items. */
export const ADJUSTMENT_LABELS: Record<Adjustment['kind'], string> = {
  hueSaturation: 'Hue/Saturation',
  replaceColor: 'Replace Color',
  invert: 'Invert',
  desaturate: 'Desaturate',
  outline: 'Outline',
  dropShadow: 'Drop Shadow',
};

/** True for effects that read neighboring pixels, rather than each pixel alone. */
export function isSpatial(a: Adjustment): boolean {
  return a.kind === 'outline' || a.kind === 'dropShadow';
}

/** Runs an adjustment on a surface. */
export function applyAdjustment(src: Surface, a: Adjustment): Uint32Array {
  switch (a.kind) {
    case 'hueSaturation':
      return hueSaturation(src, a.hue, a.saturation, a.lightness);
    case 'replaceColor':
      return replaceColor(src, a.from, a.to, a.tolerance);
    case 'invert':
      return invert(src);
    case 'desaturate':
      return desaturate(src);
    case 'outline':
      return outline(src, a.color, a);
    case 'dropShadow':
      return dropShadow(src, a.color, a.dx, a.dy);
  }
}
