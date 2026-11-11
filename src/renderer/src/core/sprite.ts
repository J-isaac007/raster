import { blend, blendMode, type BlendMode } from './color';
import { celOpacity, copyCelProps } from './cels';
import type { Rect } from './raster';
import type { Tag } from './tags';

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
 *
 * Frames can share a buffer: such "linked" cels are the same image, so
 * editing one edits them all.
 */
export interface Layer extends Surface {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  /** 0..1 */
  opacity: number;
  blendMode: BlendMode;
  /** Shown while drawing, left out of every export. */
  reference: boolean;
  /** The group this layer sits in directly, or null at the top level. */
  groupId: string | null;
  /** One buffer per frame. */
  cels: Uint32Array[];
}

/**
 * A layer group. Groups have no pixels of their own: they label a contiguous
 * run of the sprite's layers (see core/groups.ts) and can nest. A group is
 * composited on its own, then blended down with its opacity and blend mode.
 */
export interface Group {
  id: string;
  name: string;
  /** The enclosing group, or null at the top level. */
  parentId: string | null;
  visible: boolean;
  /** 0..1 */
  opacity: number;
  blendMode: BlendMode;
  /** Folded in the layer list (a view setting, saved with the file). */
  collapsed: boolean;
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
  /** Layer groups, in no particular order; layers point at them by `groupId`. */
  groups: Group[];
  frames: Frame[];
  /** Named frame ranges (animation loops). */
  tags: Tag[];
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

/** Rounds a typed-in width or height into the valid range (1 when blank). */
export const clampSpriteSize = (n: number) =>
  Math.min(MAX_SPRITE_SIZE, Math.max(1, Math.round(n) || 1));

export function createLayer(width: number, height: number, name: string, frameCount = 1): Layer {
  const cels = Array.from({ length: frameCount }, () => new Uint32Array(width * height));
  return {
    id: newId(),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    reference: false,
    groupId: null,
    width,
    height,
    cels,
    pixels: cels[0],
  };
}

export function createGroup(name: string, parentId: string | null = null): Group {
  return {
    id: newId(),
    name,
    parentId,
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    collapsed: false,
  };
}

export function createSprite(width: number, height: number, frameCount = 1): Sprite {
  assertValidSize(width, height);
  return {
    width,
    height,
    layers: [createLayer(width, height, 'Layer 1', frameCount)],
    groups: [],
    frames: Array.from({ length: frameCount }, () => ({ duration: DEFAULT_FRAME_MS })),
    tags: [],
  };
}

/**
 * Maps each distinct cel through `fn` once, so frames that shared a buffer
 * share the result too. New buffers keep the cel's properties (opacity).
 */
export function mapCels(
  cels: readonly Uint32Array[],
  fn: (cel: Uint32Array, frame: number) => Uint32Array,
): Uint32Array[] {
  const done = new Map<Uint32Array, Uint32Array>();
  return cels.map((cel, f) => {
    let out = done.get(cel);
    if (!out) {
      done.set(cel, (out = fn(cel, f)));
      copyCelProps(cel, out);
    }
    return out;
  });
}

/** For each frame, the first frame whose cel is the same buffer (itself if not linked). */
export function celLinks(cels: readonly Uint32Array[]): number[] {
  const first = new Map<Uint32Array, number>();
  return cels.map((cel, f) => {
    if (!first.has(cel)) first.set(cel, f);
    return first.get(cel)!;
  });
}

/** Every distinct cel buffer in the sprite, each once even when linked. */
export function uniqueCels(sprite: Sprite): Uint32Array[] {
  return [...new Set(sprite.layers.flatMap((l) => l.cels))];
}

export function cloneLayer(layer: Layer, name = `${layer.name} copy`): Layer {
  const cels = mapCels(layer.cels, (c) => c.slice());
  const current = layer.cels.indexOf(layer.pixels);
  return { ...layer, id: newId(), name, cels, pixels: cels[Math.max(0, current)] };
}

/** Points every layer's `pixels` at the cel for `frame`. */
export function showFrame(sprite: Sprite, frame: number): void {
  for (const layer of sprite.layers) layer.pixels = layer.cels[frame];
}

export interface CompositeOptions {
  /** Leave out reference layers, as exports do. */
  forExport?: boolean;
}

/** Flattens one frame without changing which frame is shown. */
export function compositeFrame(
  sprite: Sprite,
  frame: number,
  out?: Uint32Array,
  options?: CompositeOptions,
): Uint32Array {
  const view: Sprite = {
    ...sprite,
    layers: sprite.layers.map((l) => ({ ...l, pixels: l.cels[frame] })),
  };
  return composite(view, out, options);
}

/** Blends `src` onto `dst` in place (skipping transparent pixels). */
function blendBuffer(dst: Uint32Array, src: Uint32Array, opacity: number, mode: BlendMode): void {
  if (opacity <= 0) return;
  for (let i = 0; i < dst.length; i++) {
    const c = src[i];
    if (c >>> 24 !== 0) dst[i] = blendMode(dst[i], c, opacity, mode);
  }
}

/** Scratch buffers for compositing groups, one per nesting depth. */
const scratch: Uint32Array[] = [];
const scratchAt = (depth: number, size: number) => {
  let buf = scratch[depth];
  if (!buf || buf.length !== size) buf = scratch[depth] = new Uint32Array(size);
  buf.fill(0);
  return buf;
};

/**
 * Flattens visible layers, bottom to top, into `out` (allocated if omitted).
 * Each layer blends with its opacity × its cel's opacity and its blend mode.
 * A group with the Normal blend mode passes through: its layers blend straight
 * onto what's below, with the group's opacity applied (so a Multiply layer in a
 * group still multiplies the layers under the group). A group with another
 * blend mode composites its layers on their own first, then blends the result
 * down with its opacity and mode. A hidden group hides everything in it.
 */
export function composite(
  sprite: Sprite,
  out?: Uint32Array,
  options?: CompositeOptions,
): Uint32Array {
  const size = sprite.width * sprite.height;
  const result = out && out.length === size ? out : new Uint32Array(size);
  result.fill(0);
  const groups = new Map(sprite.groups.map((g) => [g.id, g]));
  const skip = (l: Layer) => !l.visible || (options?.forExport && l.reference);

  if (sprite.groups.length === 0) {
    for (const layer of sprite.layers) {
      if (skip(layer)) continue;
      blendBuffer(result, layer.pixels, layer.opacity * celOpacity(layer.pixels), layer.blendMode);
    }
    return result;
  }

  // Walk the stack keeping the chain of open groups. An isolated group (any
  // mode but Normal) renders into its own scratch buffer and blends into its
  // parent when it closes; a pass-through group only scales opacity.
  const chainOf = (groupId: string | null): (typeof sprite.groups)[number][] => {
    const chain = [];
    for (
      let g = groupId ? groups.get(groupId) : undefined;
      g;
      g = g.parentId ? groups.get(g.parentId) : undefined
    ) {
      chain.unshift(g);
    }
    return chain;
  };
  const open: { group: Group; buf: Uint32Array | null }[] = [];
  /** Where drawing goes: the innermost isolated group's buffer, or the result. */
  const target = () => {
    for (let i = open.length - 1; i >= 0; i--) if (open[i].buf) return open[i].buf!;
    return result;
  };
  /** The opacity of the pass-through groups between here and that target. */
  const passOpacity = () => {
    let o = 1;
    for (let i = open.length - 1; i >= 0 && !open[i].buf; i--) o *= open[i].group.opacity;
    return o;
  };
  const close = () => {
    const { group, buf } = open.pop()!;
    if (buf && group.visible) {
      blendBuffer(target(), buf, group.opacity * passOpacity(), group.blendMode);
    }
  };
  for (const layer of sprite.layers) {
    const chain = chainOf(layer.groupId);
    let keep = 0;
    while (keep < open.length && keep < chain.length && open[keep].group === chain[keep]) keep++;
    while (open.length > keep) close();
    for (let d = keep; d < chain.length; d++) {
      const isolated = chain[d].blendMode !== 'normal';
      open.push({ group: chain[d], buf: isolated ? scratchAt(d, size) : null });
    }
    if (skip(layer) || chain.some((g) => !g.visible)) continue;
    const opacity = layer.opacity * celOpacity(layer.pixels) * passOpacity();
    blendBuffer(target(), layer.pixels, opacity, layer.blendMode);
  }
  while (open.length) close();
  return result;
}

/**
 * Blends `upper` onto `lower` in place, as compositing would: with the upper
 * layer's opacity, its cel's opacity and its blend mode.
 */
export function mergeInto(lower: Layer, upper: Layer): void {
  blendBuffer(
    lower.pixels,
    upper.pixels,
    upper.opacity * celOpacity(upper.pixels),
    upper.blendMode,
  );
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
