import type { Rect } from './raster';
import { MAX_SPRITE_SIZE, type Surface } from './sprite';

/**
 * Geometry on whole surfaces: quarter turns, flips, nearest-neighbor
 * scaling and RotSprite rotation. Every function returns a new surface and
 * copies pixel values without blending, so palettes and masks stay exact.
 */

/** Rotates clockwise by `turns` quarter turns (negative turns go counterclockwise). */
export function rotateQuarter(src: Surface, turns: number): Surface {
  const t = ((Math.round(turns) % 4) + 4) % 4;
  const { width: w, height: h, pixels: p } = src;
  if (t === 0) return { width: w, height: h, pixels: p.slice() };
  if (t === 2) return { width: w, height: h, pixels: p.slice().reverse() };
  const out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Clockwise: (x, y) → (h-1-y, x). Counterclockwise: (x, y) → (y, w-1-x).
      const i = t === 1 ? x * h + (h - 1 - y) : (w - 1 - x) * h + y;
      out[i] = p[y * w + x];
    }
  }
  return { width: h, height: w, pixels: out };
}

export function flipSurface(src: Surface, axis: 'horizontal' | 'vertical'): Surface {
  const { width: w, height: h, pixels: p } = src;
  const out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    const from = axis === 'vertical' ? h - 1 - y : y;
    const row = p.subarray(from * w, from * w + w);
    if (axis === 'horizontal') out.set(row.slice().reverse(), y * w);
    else out.set(row, y * w);
  }
  return { width: w, height: h, pixels: out };
}

/** Resizes to `width` × `height`, each output pixel copying the source pixel under its center. */
export function scaleNearest(src: Surface, width: number, height: number): Surface {
  const { width: w, height: h, pixels: p } = src;
  if (width === w && height === h) return { width, height, pixels: p.slice() };
  const out = new Uint32Array(width * height);
  const cols = new Uint32Array(width);
  for (let x = 0; x < width; x++) cols[x] = Math.min(w - 1, Math.floor(((x + 0.5) * w) / width));
  for (let y = 0; y < height; y++) {
    const row = Math.min(h - 1, Math.floor(((y + 0.5) * h) / height)) * w;
    for (let x = 0; x < width; x++) out[y * width + x] = p[row + cols[x]];
  }
  return { width, height, pixels: out };
}

/**
 * Doubles a surface with the Scale2x (EPX) rule: each pixel becomes four,
 * and a corner takes a neighbor's color where two neighbors agree, so
 * diagonal edges stay sharp instead of turning into stairs.
 */
export function scale2x(src: Surface): Surface {
  const { width: w, height: h, pixels: p } = src;
  const W = w * 2;
  const out = new Uint32Array(W * h * 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = p[y * w + x];
      const a = y > 0 ? p[(y - 1) * w + x] : e; // up
      const b = x < w - 1 ? p[y * w + x + 1] : e; // right
      const c = x > 0 ? p[y * w + x - 1] : e; // left
      const d = y < h - 1 ? p[(y + 1) * w + x] : e; // down
      const i = y * 2 * W + x * 2;
      out[i] = c === a && c !== d && a !== b ? a : e;
      out[i + 1] = a === b && a !== c && b !== d ? b : e;
      out[i + W] = d === c && d !== b && c !== a ? c : e;
      out[i + W + 1] = b === d && b !== a && d !== c ? d : e;
    }
  }
  return { width: W, height: h * 2, pixels: out };
}

/** Upscaled working copies stay under this many pixels (64 MB). */
const MAX_WORK_PIXELS = 1 << 24;

/**
 * Rotates clockwise by any angle with the RotSprite method: upscale 8× with
 * Scale2x, rotate, and sample back down, so lines stay one pixel wide and
 * no new colors appear. The result is the rotated image's bounding box;
 * pixels it doesn't cover are transparent. Quarter turns are exact.
 */
export function rotSprite(src: Surface, degrees: number): Surface {
  const angle = ((degrees % 360) + 360) % 360;
  if (angle % 90 === 0) return rotateQuarter(src, angle / 90);
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const { width: w, height: h } = src;
  // Bounding box of the turned rectangle (the epsilon absorbs float error).
  const size = (n: number) => Math.min(MAX_SPRITE_SIZE * 2, Math.max(1, Math.ceil(n - 1e-6)));
  const W = size(Math.abs(w * cos) + Math.abs(h * sin));
  const H = size(Math.abs(w * sin) + Math.abs(h * cos));

  let big = src;
  let factor = 1;
  while (factor < 8 && big.width * big.height * 4 <= MAX_WORK_PIXELS) {
    big = scale2x(big);
    factor *= 2;
  }

  const out = new Uint32Array(W * H);
  for (let oy = 0; oy < H; oy++) {
    const dy = oy + 0.5 - H / 2;
    for (let ox = 0; ox < W; ox++) {
      const dx = ox + 0.5 - W / 2;
      // Inverse of a clockwise turn (y points down).
      const sx = dx * cos + dy * sin + w / 2;
      const sy = -dx * sin + dy * cos + h / 2;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const bx = Math.min(big.width - 1, Math.floor(sx * factor));
      const by = Math.min(big.height - 1, Math.floor(sy * factor));
      out[oy * W + ox] = big.pixels[by * big.width + bx];
    }
  }
  return { width: W, height: H, pixels: out };
}

export interface Transform {
  /** Clockwise, in degrees. */
  angle: number;
  /** 1 = unchanged. */
  scaleX: number;
  scaleY: number;
}

/** Scales (nearest neighbor), then rotates (RotSprite). Sizes are capped at MAX_SPRITE_SIZE. */
export function transformSurface(src: Surface, t: Transform): Surface {
  const fit = (n: number) => Math.min(MAX_SPRITE_SIZE, Math.max(1, Math.round(n)));
  const scaled = scaleNearest(src, fit(src.width * t.scaleX), fit(src.height * t.scaleY));
  return rotSprite(scaled, t.angle);
}

/** The smallest rectangle holding every non-transparent pixel of the buffers, or null if all are empty. */
export function contentBounds(
  width: number,
  height: number,
  buffers: Iterable<Uint32Array>,
): Rect | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (const p of buffers) {
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        if (p[row + x] >>> 24 === 0) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}
