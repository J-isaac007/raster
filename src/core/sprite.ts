import { blend, type Color } from './color';
import type { Rect } from './raster';

export const MAX_SPRITE_SIZE = 2048;

/** Anything with a pixel buffer: layers, composites, scratch buffers. */
export interface Surface {
  width: number;
  height: number;
  pixels: Uint32Array;
}

/**
 * A layer holds one pixel buffer ("cel") per animation frame. `pixels` always
 * points at the cel of the frame being viewed (see `showFrame`), so code that
 * edits the current image never needs to know about frames.
 */
export interface Layer extends Surface {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  /** 0..1 */
  opacity: number;
  /** One buffer per frame. */
  cels: Uint32Array[];
}

export interface Frame {
  /** How long the frame shows during playback, in milliseconds. */
  duration: number;
}

export const DEFAULT_FRAME_MS = 100;

export interface Sprite {
  width: number;
  height: number;
  /** Bottom to top. */
  layers: Layer[];
  frames: Frame[];
}

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function assertValidSize(width: number, height: number): void {
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_SPRITE_SIZE;
  if (!ok(width) || !ok(height)) {
    throw new RangeError(`Sprite size must be whole numbers from 1 to ${MAX_SPRITE_SIZE}.`);
  }
}

export function createLayer(width: number, height: number, name: string, frameCount = 1): Layer {
  const cels = Array.from({ length: frameCount }, () => new Uint32Array(width * height));
  return {
    id: newId(),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    width,
    height,
    cels,
    pixels: cels[0],
  };
}

export function createSprite(width: number, height: number, frameCount = 1): Sprite {
  assertValidSize(width, height);
  return {
    width,
    height,
    layers: [createLayer(width, height, 'Layer 1', frameCount)],
    frames: Array.from({ length: frameCount }, () => ({ duration: DEFAULT_FRAME_MS })),
  };
}

export function cloneLayer(layer: Layer, name = `${layer.name} copy`): Layer {
  const cels = layer.cels.map((c) => c.slice());
  const current = layer.cels.indexOf(layer.pixels);
  return { ...layer, id: newId(), name, cels, pixels: cels[Math.max(0, current)] };
}

/** Points every layer's `pixels` at the cel for `frame`. */
export function showFrame(sprite: Sprite, frame: number): void {
  for (const layer of sprite.layers) layer.pixels = layer.cels[frame];
}

/** Flattens one frame without changing which frame is shown. */
export function compositeFrame(sprite: Sprite, frame: number, out?: Uint32Array): Uint32Array {
  const view: Sprite = {
    ...sprite,
    layers: sprite.layers.map((l) => ({ ...l, pixels: l.cels[frame] })),
  };
  return composite(view, out);
}

/** Flattens visible layers, bottom to top, into `out` (allocated if omitted). */
export function composite(sprite: Sprite, out?: Uint32Array): Uint32Array {
  const size = sprite.width * sprite.height;
  const result = out && out.length === size ? out : new Uint32Array(size);
  result.fill(0);
  for (const layer of sprite.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    const src = layer.pixels;
    const opacity = layer.opacity;
    for (let i = 0; i < size; i++) {
      const c: Color = src[i];
      if (c >>> 24 === 0) continue;
      result[i] = blend(result[i], c, opacity);
    }
  }
  return result;
}

/** Blends `upper` onto `lower` in place, honoring the upper layer's opacity. */
export function mergeInto(lower: Layer, upper: Layer): void {
  const dst = lower.pixels;
  const src = upper.pixels;
  for (let i = 0; i < dst.length; i++) {
    if (src[i] >>> 24 !== 0) dst[i] = blend(dst[i], src[i], upper.opacity);
  }
}

export function flipPixels(surface: Surface, axis: 'horizontal' | 'vertical'): void {
  const { width: w, height: h, pixels: p } = surface;
  if (axis === 'horizontal') {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      p.subarray(row, row + w).reverse();
    }
  } else {
    const tmp = new Uint32Array(w);
    for (let y = 0; y < h >> 1; y++) {
      const a = y * w;
      const b = (h - 1 - y) * w;
      tmp.set(p.subarray(a, a + w));
      p.copyWithin(a, b, b + w);
      p.set(tmp, b);
    }
  }
}

/**
 * Copies a surface's pixels into a new `width` × `height` buffer, placing the
 * old top-left corner at (`offsetX`, `offsetY`). Pixels outside are dropped.
 */
export function resizePixels(
  src: Surface,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
): Uint32Array {
  const out = new Uint32Array(width * height);
  for (let y = 0; y < src.height; y++) {
    const ty = y + offsetY;
    if (ty < 0 || ty >= height) continue;
    const x0 = Math.max(0, -offsetX);
    const x1 = Math.min(src.width, width - offsetX);
    if (x1 <= x0) continue;
    out.set(src.pixels.subarray(y * src.width + x0, y * src.width + x1), ty * width + x0 + offsetX);
  }
  return out;
}

/** Copies the `rect` area of a surface. Pixels outside the source are transparent. */
export function copyRect(src: Surface, rect: Rect): Surface {
  const { x, y, width, height } = rect;
  const out = new Uint32Array(width * height);
  for (let row = 0; row < height; row++) {
    const sy = y + row;
    if (sy < 0 || sy >= src.height) continue;
    const x0 = Math.max(0, x);
    const x1 = Math.min(src.width, x + width);
    if (x1 <= x0) continue;
    out.set(src.pixels.subarray(sy * src.width + x0, sy * src.width + x1), row * width + x0 - x);
  }
  return { width, height, pixels: out };
}

/** Blends `src` onto `dst` with its top-left corner at (x, y). Pixels outside `dst` are dropped. */
export function stamp(dst: Surface, src: Surface, x: number, y: number): void {
  for (let row = 0; row < src.height; row++) {
    const dy = y + row;
    if (dy < 0 || dy >= dst.height) continue;
    for (let col = 0; col < src.width; col++) {
      const dx = x + col;
      const c = src.pixels[row * src.width + col];
      if (dx < 0 || dx >= dst.width || c >>> 24 === 0) continue;
      const i = dy * dst.width + dx;
      dst.pixels[i] = blend(dst.pixels[i], c);
    }
  }
}
