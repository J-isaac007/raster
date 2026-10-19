import type { Surface } from './sprite';

/** Receives each pixel a primitive covers. May be called more than once per pixel. */
export type Plot = (x: number, y: number) => void;

/** An axis-aligned pixel rectangle. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The rectangle spanned by two corner pixels, both included. */
export function rectFromCorners(x0: number, y0: number, x1: number, y1: number): Rect {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, width: Math.abs(x1 - x0) + 1, height: Math.abs(y1 - y0) + 1 };
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;
}

/**
 * A selected area: its bounding rectangle, plus a mask when it isn't the
 * whole rectangle (lasso, magic wand). `mask[row * width + col]` is 1 for
 * selected pixels. Never mutated once created.
 */
export interface Selection extends Rect {
  mask?: Uint8Array;
}

export function selectionContains(s: Selection, x: number, y: number): boolean {
  if (!rectContains(s, x, y)) return false;
  return !s.mask || s.mask[(y - s.y) * s.width + x - s.x] === 1;
}

/** The overlap of two rectangles, or null if they don't touch. */
export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

export function inBounds(s: { width: number; height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < s.width && y < s.height;
}

export function getPixel(s: Surface, x: number, y: number): number {
  return inBounds(s, x, y) ? s.pixels[y * s.width + x] : 0;
}

export function setPixel(s: Surface, x: number, y: number, color: number): void {
  if (inBounds(s, x, y)) s.pixels[y * s.width + x] = color;
}

/** Bresenham line, endpoints included. */
export function plotLine(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export function plotRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
  plot: Plot,
): void {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  for (let y = top; y <= bottom; y++) {
    if (filled || y === top || y === bottom) {
      for (let x = left; x <= right; x++) plot(x, y);
    } else {
      plot(left, y);
      plot(right, y);
    }
  }
}

/**
 * Ellipse inscribed in the rectangle spanned by two corners.
 * Based on Alois Zingl's "A Rasterizing Algorithm for Drawing Curves" (2012).
 */
export function plotEllipse(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
  plot: Plot,
): void {
  const span = (y: number, from: number, to: number) => {
    if (filled) for (let x = from; x <= to; x++) plot(x, y);
    else {
      plot(from, y);
      plot(to, y);
    }
  };

  let a = Math.abs(x1 - x0);
  const b = Math.abs(y1 - y0);
  let b1 = b & 1;
  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;

  if (x0 > x1) {
    x0 = x1;
    x1 += a;
  }
  if (y0 > y1) y0 = y1;
  y0 += (b + 1) >> 1;
  y1 = y0 - b1;
  a = 8 * a * a;
  b1 = 8 * b * b;

  do {
    span(y0, x0, x1);
    span(y1, x0, x1);
    const e2 = 2 * err;
    if (e2 <= dy) {
      y0++;
      y1--;
      dy += a;
      err += dy;
    }
    if (e2 >= dx || 2 * err > dy) {
      x0++;
      x1--;
      dx += b1;
      err += dx;
    }
  } while (x0 <= x1);

  // Flat ellipses stop early; finish the tips.
  while (y0 - y1 <= b) {
    span(y0++, x0 - 1, x1 + 1);
    span(y1--, x0 - 1, x1 + 1);
  }
}

/** Calls `plot` for each pixel of a square brush of `size` centered on (x, y). */
export function plotBrush(x: number, y: number, size: number, plot: Plot): void {
  if (size <= 1) {
    plot(x, y);
    return;
  }
  const start = -Math.floor((size - 1) / 2);
  for (let oy = start; oy < start + size; oy++) {
    for (let ox = start; ox < start + size; ox++) plot(x + ox, y + oy);
  }
}

/**
 * Returns the indices of pixels matching the color at (x, y): the 4-connected
 * region when `contiguous`, otherwise every matching pixel on the surface.
 * Pixels outside `bounds`, when given, are never included.
 */
export function floodRegion(
  s: Surface,
  x: number,
  y: number,
  contiguous = true,
  bounds?: Selection,
): Uint32Array {
  if (!inBounds(s, x, y) || (bounds && !selectionContains(bounds, x, y))) {
    return new Uint32Array(0);
  }
  const { width: w, height: h, pixels } = s;
  const target = pixels[y * w + x];
  const inside = (i: number) => {
    if (!bounds) return true;
    const px = i % w;
    return selectionContains(bounds, px, (i - px) / w);
  };

  if (!contiguous) {
    const out: number[] = [];
    for (let i = 0; i < pixels.length; i++) if (pixels[i] === target && inside(i)) out.push(i);
    return Uint32Array.from(out);
  }

  const seen = new Uint8Array(w * h);
  const out: number[] = [];
  const stack = [y * w + x];
  seen[y * w + x] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    out.push(i);
    const px = i % w;
    const py = (i - px) / w;
    const visit = (j: number) => {
      if (!seen[j] && pixels[j] === target && inside(j)) {
        seen[j] = 1;
        stack.push(j);
      }
    };
    if (px > 0) visit(i - 1);
    if (px < w - 1) visit(i + 1);
    if (py > 0) visit(i - w);
    if (py < h - 1) visit(i + w);
  }
  return Uint32Array.from(out);
}

/** Snaps (x1, y1) so the line from (x0, y0) is horizontal, vertical or 45°. */
export function snapAngle(x0: number, y0: number, x1: number, y1: number): [number, number] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx > ady * 2) return [x1, y0];
  if (ady > adx * 2) return [x0, y1];
  const d = Math.max(adx, ady);
  return [x0 + Math.sign(dx) * d, y0 + Math.sign(dy) * d];
}

/** Snaps (x1, y1) so the box from (x0, y0) is square. */
export function snapSquare(x0: number, y0: number, x1: number, y1: number): [number, number] {
  const d = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  return [x0 + (Math.sign(x1 - x0) || 1) * d, y0 + (Math.sign(y1 - y0) || 1) * d];
}
