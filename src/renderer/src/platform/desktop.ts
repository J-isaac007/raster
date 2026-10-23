/**
 * The desktop app's bridge (`window.raster`, from src/preload). Undefined
 * outside Electron, e.g. in unit tests.
 */
import type { DesktopFile, FileFilter, RasterApi } from '@shared/api';

export type { DesktopFile, FileFilter, UpdateStatus } from '@shared/api';

export const desktop: RasterApi | undefined =
  typeof window === 'undefined' ? undefined : (window as { raster?: RasterApi }).raster;

/** A File that may know where it lives on disk (desktop only). */
export type PickedFile = File & { path?: string };

const MIME: Record<string, string> = {
  raster: 'application/x-raster',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  bmp: 'image/bmp',
  json: 'application/json',
  hex: 'text/plain',
  gpl: 'text/plain',
  txt: 'text/plain',
};

const extOf = (name: string) => /\.([^.]+)$/.exec(name)?.[1].toLowerCase() ?? '';

export function toFile(file: DesktopFile): PickedFile {
  const type = MIME[extOf(file.name)] ?? '';
  return Object.assign(new File([file.data as BlobPart], file.name, { type }), { path: file.path });
}

const IMAGE_EXTENSIONS = ['png', 'gif', 'webp', 'jpg', 'jpeg', 'bmp'];
const FILTER_NAMES: Record<string, string> = {
  raster: 'Raster project',
  png: 'PNG image',
  gif: 'GIF image',
  json: 'JSON data',
  hex: 'Palette',
};

/** Turns an `<input accept>` string into native dialog filters. */
export function filtersFromAccept(accept: string): FileFilter[] {
  const extensions = new Set<string>();
  for (const token of accept.split(',').map((t) => t.trim().toLowerCase())) {
    if (token.startsWith('.')) extensions.add(token.slice(1));
    else if (token === 'image/*') IMAGE_EXTENSIONS.forEach((e) => extensions.add(e));
    else if (token.startsWith('image/')) {
      const sub = token.slice(6);
      extensions.add(sub);
      if (sub === 'jpeg') extensions.add('jpg');
    }
  }
  const list = [...extensions].filter((e) => e !== 'json' || extensions.size === 1);
  const name =
    list.length === 1 ? (FILTER_NAMES[list[0]] ?? list[0].toUpperCase()) : 'Supported files';
  return [{ name, extensions: list }];
}

/** The save-dialog filter for a file name like `hero.png`. */
export function filterForName(fileName: string): FileFilter[] {
  const ext = extOf(fileName);
  return ext ? [{ name: FILTER_NAMES[ext] ?? `${ext.toUpperCase()} file`, extensions: [ext] }] : [];
}
