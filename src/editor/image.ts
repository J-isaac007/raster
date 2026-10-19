import { MAX_FRAMES } from '../core/format';
import { decodeGif } from '../core/gifDecode';
import {
  assertValidSize,
  createLayer,
  DEFAULT_FRAME_MS,
  type Sprite,
  type Surface,
} from '../core/sprite';
import { baseName } from './files';

/** Image encode/decode between pixels, canvases, PNGs and image files. */

/** Renders pixels into a canvas, scaled up with nearest-neighbor. */
export function pixelsToCanvas(
  pixels: Uint32Array,
  width: number,
  height: number,
  scale = 1,
): HTMLCanvasElement {
  const src = document.createElement('canvas');
  src.width = width;
  src.height = height;
  const img = new ImageData(width, height);
  img.data.set(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength));
  src.getContext('2d')!.putImageData(img, 0, 0);
  if (scale === 1) return src;

  const out = document.createElement('canvas');
  out.width = width * scale;
  out.height = height * scale;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'),
  );
}

/** Decodes an image (PNG, GIF, ...) into pixels. */
export async function decodeImage(blob: Blob): Promise<Surface> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  assertValidSize(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = ctx.getImageData(0, 0, width, height).data;
  const pixels = new Uint32Array(width * height);
  new Uint8Array(pixels.buffer).set(data);
  return { width, height, pixels };
}

/**
 * Decodes an image file into a single-layer sprite. Animated GIFs become one
 * frame per GIF frame, keeping their timing.
 */
export async function imageFileToSprite(file: File): Promise<Sprite> {
  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
  if (isGif) {
    const gif = decodeGif(new Uint8Array(await file.arrayBuffer()));
    assertValidSize(gif.width, gif.height);
    const frames = gif.frames.slice(0, MAX_FRAMES);
    const layer = createLayer(gif.width, gif.height, baseName(file.name), frames.length);
    frames.forEach((f, i) => layer.cels[i].set(f.pixels));
    return {
      width: gif.width,
      height: gif.height,
      layers: [layer],
      frames: frames.map((f) => ({ duration: f.delayMs })),
      tags: [],
    };
  }
  const { width, height, pixels } = await decodeImage(file);
  const layer = createLayer(width, height, baseName(file.name));
  layer.pixels.set(pixels);
  return { width, height, layers: [layer], frames: [{ duration: DEFAULT_FRAME_MS }], tags: [] };
}
