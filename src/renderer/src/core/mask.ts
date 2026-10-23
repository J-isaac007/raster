import { TRANSPARENT } from './color';
import { floodRegion, intersectRect, plotLine, selectionContains, type Selection } from './raster';
import type { Surface } from './sprite';

/** How a new selection combines with the current one. */
export type SelectMode = 'replace' | 'add' | 'subtract';

export interface Point {
  x: number;
  y: number;
}

/** A selection outline segment from (x0, y0) to (x1, y1), on pixel edges. */
export type Edge = [x0: number, y0: number, x1: number, y1: number];

/**
 * Builds a selection from a canvas-sized mask (1 = selected), trimmed to the
 * selected pixels. The mask is dropped when the whole rectangle is selected.
 * Null if nothing is selected.
 */
export function selectionFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
): Selection | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = new Uint8Array(w * h);
  for (let row = 0; row < h; row++) {
    const start = (y0 + row) * width + x0;
    out.set(mask.subarray(start, start + w), row * w);
  }
  const rect = { x: x0, y: y0, width: w, height: h };
  return out.every((v) => v === 1) ? rect : { ...rect, mask: out };
}

/** Sets the selected pixels of a canvas-sized mask to `value`. */
function paintMask(
  sel: Selection,
  mask: Uint8Array,
  width: number,
  height: number,
  value: 0 | 1,
): void {
  const r = intersectRect(sel, { x: 0, y: 0, width, height });
  if (!r) return;
  for (let y = r.y; y < r.y + r.height; y++) {
    for (let x = r.x; x < r.x + r.width; x++) {
      if (selectionContains(sel, x, y)) mask[y * width + x] = value;
    }
  }
}

/** The part of a selection inside a width × height canvas, or null. */
export function clipSelection(sel: Selection, width: number, height: number): Selection | null {
  if (!sel.mask) return intersectRect(sel, { x: 0, y: 0, width, height });
  const mask = new Uint8Array(width * height);
  paintMask(sel, mask, width, height, 1);
  return selectionFromMask(mask, width, height);
}

/**
 * Combines the current selection with a new one: `replace` keeps only the
 * new one, `add` unites them and `subtract` removes the new from the current.
 */
export function combineSelections(
  current: Selection | null,
  next: Selection | null,
  mode: SelectMode,
  width: number,
  height: number,
): Selection | null {
  if (mode === 'replace' || (!current && mode === 'add')) {
    return next && clipSelection(next, width, height);
  }
  if (!current) return null;
  if (!next) return clipSelection(current, width, height);
  const mask = new Uint8Array(width * height);
  paintMask(current, mask, width, height, 1);
  paintMask(next, mask, width, height, mode === 'add' ? 1 : 0);
  return selectionFromMask(mask, width, height);
}

/** Everything on the canvas that isn't selected. */
export function invertSelection(
  sel: Selection | null,
  width: number,
  height: number,
): Selection | null {
  const mask = new Uint8Array(width * height).fill(1);
  if (sel) paintMask(sel, mask, width, height, 0);
  return selectionFromMask(mask, width, height);
}

/**
 * The pixels inside a closed polygon through pixel centers, plus the pixels
 * on its outline (so a thin lasso stroke still selects what it touched).
 */
export function polygonSelection(points: Point[], width: number, height: number): Selection | null {
  if (!points.length) return null;
  const mask = new Uint8Array(width * height);
  const put = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < width && y < height) mask[y * width + x] = 1;
  };
  const n = points.length;
  const minY = Math.max(0, Math.min(...points.map((p) => p.y)));
  const maxY = Math.min(height - 1, Math.max(...points.map((p) => p.y)));
  for (let y = minY; y <= maxY; y++) {
    // Even-odd scanline fill; each edge counts on the half-open range [low, high).
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      if (a.y <= y === b.y <= y) continue;
      xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) put(x, y);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    plotLine(a.x, a.y, b.x, b.y, put);
  }
  return selectionFromMask(mask, width, height);
}

/**
 * Magic wand: the pixels matching the color at (x, y), either the connected
 * region or (when not `contiguous`) every matching pixel.
 */
export function colorSelection(
  s: Surface,
  x: number,
  y: number,
  contiguous: boolean,
): Selection | null {
  const mask = new Uint8Array(s.width * s.height);
  for (const i of floodRegion(s, x, y, contiguous)) mask[i] = 1;
  return selectionFromMask(mask, s.width, s.height);
}

/** Copies the selected pixels; unselected ones in the bounding box are transparent. */
export function copySelection(src: Surface, sel: Selection): Surface {
  const { x, y, width, height } = sel;
  const pixels = new Uint32Array(width * height);
  for (let row = 0; row < height; row++) {
    const sy = y + row;
    if (sy < 0 || sy >= src.height) continue;
    for (let col = 0; col < width; col++) {
      const sx = x + col;
      if (sx < 0 || sx >= src.width) continue;
      if (sel.mask && !sel.mask[row * width + col]) continue;
      pixels[row * width + col] = src.pixels[sy * src.width + sx];
    }
  }
  return { width, height, pixels };
}

/** Makes the selected pixels transparent. */
export function clearSelection(dst: Surface, sel: Selection): void {
  const r = intersectRect(sel, { x: 0, y: 0, width: dst.width, height: dst.height });
  if (!r) return;
  for (let y = r.y; y < r.y + r.height; y++) {
    for (let x = r.x; x < r.x + r.width; x++) {
      if (selectionContains(sel, x, y)) dst.pixels[y * dst.width + x] = TRANSPARENT;
    }
  }
}

/**
 * The selection's outline along pixel edges, as horizontal and vertical
 * segments with neighbouring pieces joined (for drawing marching ants).
 */
export function selectionOutline(sel: Selection): Edge[] {
  const { x, y, width: w, height: h } = sel;
  if (!sel.mask) {
    return [
      [x, y, x + w, y],
      [x + w, y, x + w, y + h],
      [x, y + h, x + w, y + h],
      [x, y, x, y + h],
    ];
  }
  const mask = sel.mask;
  const at = (col: number, row: number) =>
    col >= 0 && row >= 0 && col < w && row < h && mask[row * w + col] === 1;
  const edges: Edge[] = [];
  // Horizontal edges sit between rows row-1 and row.
  for (let row = 0; row <= h; row++) {
    let start = -1;
    for (let col = 0; col <= w; col++) {
      const edge = col < w && at(col, row - 1) !== at(col, row);
      if (edge && start < 0) start = col;
      if (!edge && start >= 0) {
        edges.push([x + start, y + row, x + col, y + row]);
        start = -1;
      }
    }
  }
  // Vertical edges sit between columns col-1 and col.
  for (let col = 0; col <= w; col++) {
    let start = -1;
    for (let row = 0; row <= h; row++) {
      const edge = row < h && at(col - 1, row) !== at(col, row);
      if (edge && start < 0) start = row;
      if (!edge && start >= 0) {
        edges.push([x + col, y + start, x + col, y + row]);
        start = -1;
      }
    }
  }
  return edges;
}
