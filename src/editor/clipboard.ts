import type { Surface } from '../core/sprite';
import { canvasToPng, decodeImage, pixelsToCanvas } from './image';

/**
 * Tags what Raster puts on the system clipboard, so pasting our own copy uses
 * the exact pixels (PNG round trips can shift translucent colors).
 */
let clipboardTag = '';

/** Puts pixels on the system clipboard as a PNG. Best effort. */
export async function writeClipboardImage(surface: Surface): Promise<void> {
  clipboardTag = `raster-clipboard:${Date.now()}`;
  const tag = new Blob([clipboardTag], { type: 'text/plain' });
  const png = canvasToPng(pixelsToCanvas(surface.pixels, surface.width, surface.height));
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png, 'text/plain': tag })]);
  } catch {
    // No image support: still replace whatever was there so a stale image isn't pasted.
    await navigator.clipboard?.writeText(clipboardTag).catch(() => {});
  }
}

/**
 * Reads an image from a paste event or, without one, from the async clipboard
 * API. Returns null when the clipboard holds Raster's own copy or no image.
 */
export async function readClipboardImage(data?: DataTransfer | null): Promise<Surface | null> {
  if (data) {
    if (clipboardTag && data.getData('text/plain') === clipboardTag) return null;
    const file = [...data.files].find((f) => f.type.startsWith('image/'));
    return file ? decodeImage(file) : null;
  }
  try {
    for (const item of await navigator.clipboard.read()) {
      if (item.types.includes('text/plain')) {
        const text = await (await item.getType('text/plain')).text();
        if (clipboardTag && text === clipboardTag) return null;
      }
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) return decodeImage(await item.getType(type));
    }
  } catch {
    // Permission denied or unsupported: fall back to the internal clipboard.
  }
  return null;
}
