import {
  FILE_EXTENSION,
  MAX_FRAMES,
  parseProject,
  serializeProject,
  type Project,
} from '../core/format';
import { decodeGif } from '../core/gifDecode';
import {
  assertValidSize,
  createLayer,
  DEFAULT_FRAME_MS,
  type Sprite,
  type Surface,
} from '../core/sprite';
import { desktop, filterForName, filtersFromAccept, toFile, type PickedFile } from './desktop';

/**
 * File plumbing: open dialogs, saving, PNG encode/decode. In the desktop app
 * this uses native dialogs; in a plain browser (development) it falls back to
 * file inputs and downloads.
 */

export async function pickFile(accept: string): Promise<PickedFile | null> {
  if (desktop) {
    const file = await desktop.openFile({ filters: filtersFromAccept(accept) });
    return file ? toFile(file) : null;
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

/** Saves a generated file: a native save dialog on desktop, a download in a browser. */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (desktop) {
    const bridge = desktop;
    void blob.arrayBuffer().then((data) =>
      bridge.saveFile({
        defaultName: fileName,
        filters: filterForName(fileName),
        data: new Uint8Array(data),
      }),
    );
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'untitled';
}

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
    };
  }
  const { width, height, pixels } = await decodeImage(file);
  const layer = createLayer(width, height, baseName(file.name));
  layer.pixels.set(pixels);
  return { width, height, layers: [layer], frames: [{ duration: DEFAULT_FRAME_MS }] };
}

// ---- system clipboard -------------------------------------------------------

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

// ---- project files ----------------------------------------------------------

interface SaveFileHandle {
  name: string;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

interface FilePickerWindow {
  showSaveFilePicker?: (options: unknown) => Promise<SaveFileHandle>;
}

/** Remembered so Ctrl+S overwrites the file that's open. */
let currentPath: string | null = null;
let currentHandle: SaveFileHandle | null = null;

export function forgetFileHandle(): void {
  currentPath = null;
  currentHandle = null;
}

/**
 * Saves a project. Ctrl+S overwrites the open file; Save As (or a new
 * document) asks where. Returns the saved file's name, or null if cancelled.
 */
export async function saveProject(
  project: Project,
  fileName: string,
  saveAs = false,
): Promise<string | null> {
  const json = serializeProject(project);
  const name = baseName(fileName) + FILE_EXTENSION;

  if (desktop) {
    const saved = await desktop.saveFile({
      path: saveAs ? null : currentPath,
      defaultName: name,
      filters: [{ name: 'Raster project', extensions: [FILE_EXTENSION.slice(1)] }],
      data: new TextEncoder().encode(json),
    });
    if (!saved) return null;
    currentPath = saved;
    return saved.split(/[\\/]/).pop() ?? name;
  }

  const blob = new Blob([json], { type: 'application/json' });
  const picker = (window as FilePickerWindow).showSaveFilePicker;

  if (picker) {
    try {
      if (saveAs || !currentHandle) {
        currentHandle = await picker({
          suggestedName: name,
          types: [
            { description: 'Raster project', accept: { 'application/json': [FILE_EXTENSION] } },
          ],
        });
      }
      const writable = await currentHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return currentHandle.name;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null;
      throw e;
    }
  }

  downloadBlob(blob, name);
  return name;
}

export async function openProjectFile(file: PickedFile): Promise<Project> {
  forgetFileHandle();
  const project = parseProject(await file.text());
  currentPath = file.path ?? null;
  return project;
}
