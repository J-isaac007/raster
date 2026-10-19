import type { Surface } from './sprite';
import type { Tag } from './tags';

export interface SheetOptions {
  /** Frames per row. Defaults to a roughly square grid. */
  columns?: number;
  /** Transparent pixels between frames. Default 0. */
  padding?: number;
}

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetLayout {
  width: number;
  height: number;
  frames: FrameRect[];
  columns: number;
  rows: number;
}

export interface Sheet extends SheetLayout, Surface {}

/** Where each of `count` frames goes in a grid, left to right, top to bottom. */
export function layoutSheet(
  count: number,
  width: number,
  height: number,
  options: SheetOptions = {},
): SheetLayout {
  if (count === 0) throw new RangeError('A sprite sheet needs at least one frame.');
  const columns = Math.min(count, Math.max(1, options.columns ?? Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / columns);
  const pad = Math.max(0, options.padding ?? 0);
  const frames = Array.from({ length: count }, (_, i) => ({
    x: (i % columns) * (width + pad),
    y: Math.floor(i / columns) * (height + pad),
    w: width,
    h: height,
  }));
  return {
    width: columns * width + (columns - 1) * pad,
    height: rows * height + (rows - 1) * pad,
    frames,
    columns,
    rows,
  };
}

/** Copies frames into a sprite sheet laid out by `layoutSheet`. */
export function packSheet(
  frames: Uint32Array[],
  width: number,
  height: number,
  options: SheetOptions = {},
): Sheet {
  const layout = layoutSheet(frames.length, width, height, options);
  const pixels = new Uint32Array(layout.width * layout.height);
  frames.forEach((src, i) => {
    const { x, y } = layout.frames[i];
    for (let row = 0; row < height; row++) {
      pixels.set(src.subarray(row * width, (row + 1) * width), (y + row) * layout.width + x);
    }
  });
  return { ...layout, pixels };
}

/**
 * JSON metadata in the widely supported "array" layout (as written by
 * Aseprite and TexturePacker), so game engines can slice the sheet. Tags are
 * written as Aseprite-style `frameTags`.
 */
export function sheetMetadata(
  sheet: SheetLayout,
  imageName: string,
  durationsMs: number[],
  frameName = (i: number) => `${i}`,
  tags: readonly Tag[] = [],
): string {
  return JSON.stringify(
    {
      frames: sheet.frames.map((r, i) => ({
        filename: frameName(i),
        frame: r,
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: r.w, h: r.h },
        sourceSize: { w: r.w, h: r.h },
        duration: durationsMs[i] ?? 100,
      })),
      meta: {
        app: 'Raster',
        image: imageName,
        format: 'RGBA8888',
        size: { w: sheet.width, h: sheet.height },
        scale: '1',
        frameTags: tags.map(({ name, from, to }) => ({ name, from, to, direction: 'forward' })),
      },
    },
    null,
    2,
  );
}
