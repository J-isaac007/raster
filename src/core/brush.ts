import { alpha, blue, green, red, rgba, type Color } from './color';

// ---- ordered dithering ------------------------------------------------------

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Number of dither levels; level 0 paints nothing and DITHER_LEVELS paints everything. */
export const DITHER_LEVELS = 16;

/**
 * Whether an ordered-dither brush at `level` (0..16) paints pixel (x, y).
 * Patterns are anchored to the canvas, so overlapping strokes line up.
 */
export function ditherHit(x: number, y: number, level: number): boolean {
  return BAYER4[y & 3][x & 3] < level;
}

// ---- pixel-perfect strokes --------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

/**
 * Removes "L" corners from freehand strokes so diagonals stay one pixel thin.
 *
 * Feed it each pixel a stroke visits, in order. When the middle of the last
 * three points forms an L corner, `push` returns that point so the caller can
 * undo it.
 */
export class PixelPerfect {
  private points: Point[] = [];

  push(p: Point): Point | null {
    const pts = this.points;
    const last = pts[pts.length - 1];
    if (last && last.x === p.x && last.y === p.y) return null;
    pts.push(p);
    if (pts.length < 3) return null;
    const [a, b, c] = pts.slice(-3);
    const corner =
      Math.abs(a.x - c.x) === 1 &&
      Math.abs(a.y - c.y) === 1 &&
      (b.x === a.x || b.y === a.y) &&
      (b.x === c.x || b.y === c.y);
    if (!corner) {
      if (pts.length > 3) pts.shift();
      return null;
    }
    pts.splice(pts.length - 2, 1);
    return b;
  }

  reset(): void {
    this.points = [];
  }
}

// ---- shading ----------------------------------------------------------------

function toHsl(c: Color): [number, number, number] {
  const r = red(c) / 255;
  const g = green(c) / 255;
  const b = blue(c) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number, a: number): Color {
  if (s === 0) {
    const v = Math.round(l * 255);
    return rgba(v, v, v, a);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return rgba(
    Math.round(hue(h + 1 / 3) * 255),
    Math.round(hue(h) * 255),
    Math.round(hue(h - 1 / 3) * 255),
    a,
  );
}

/** Lightens (`amount` > 0) or darkens (< 0) a color in HSL space. */
export function adjustLightness(c: Color, amount: number): Color {
  const [h, s, l] = toHsl(c);
  return fromHsl(h, s, Math.min(1, Math.max(0, l + amount)), alpha(c));
}

/**
 * The shade tool's color step. If the color is in the palette, moves to the
 * neighboring palette entry (palettes are usually ordered as ramps);
 * otherwise nudges its lightness. Transparent pixels stay transparent.
 */
export function shadeColor(c: Color, palette: Color[], dir: 1 | -1): Color {
  if (alpha(c) === 0) return c;
  const i = palette.indexOf(c);
  if (i >= 0) return palette[Math.min(palette.length - 1, Math.max(0, i + dir))];
  return adjustLightness(c, dir * 0.08);
}

// ---- custom brushes -----------------------------------------------------------

/** A brush made from pixels (usually a selection), stamped centered on the cursor. */
export interface CustomBrush {
  width: number;
  height: number;
  /** Row-major RGBA. Never mutated once made. */
  pixels: Uint32Array;
}

/** `image` paints the brush's own colors; `color` paints the current color in its shape. */
export type BrushMode = 'image' | 'color';

/**
 * Makes a brush from pixels, trimming fully transparent rows and columns.
 * Returns null when every pixel is transparent.
 */
export function makeCustomBrush(src: {
  width: number;
  height: number;
  pixels: Uint32Array;
}): CustomBrush | null {
  let x0 = src.width;
  let y0 = src.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (alpha(src.pixels[y * src.width + x]) === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const width = x1 - x0 + 1;
  const height = y1 - y0 + 1;
  const pixels = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    const from = (y0 + y) * src.width + x0;
    pixels.set(src.pixels.subarray(from, from + width), y * width);
  }
  return { width, height, pixels };
}

/**
 * Offset from a brush's top-left pixel to its hot spot, matching how square
 * brushes center (`plotBrush`): the middle pixel, or just left/up of middle.
 */
export function brushOrigin(brush: { width: number; height: number }): [number, number] {
  return [Math.floor((brush.width - 1) / 2), Math.floor((brush.height - 1) / 2)];
}

/** The color a custom brush pixel paints: its own, or `color` with its alpha as a mask. */
export function brushPixelColor(mode: BrushMode, brushPixel: Color, color: Color): Color {
  if (mode === 'image') return brushPixel;
  return rgba(
    red(color),
    green(color),
    blue(color),
    Math.round((alpha(color) * alpha(brushPixel)) / 255),
  );
}
