/**
 * The desktop app's bridge (`window.raster`, from electron/preload.cjs).
 * Undefined when the page runs in a plain browser, e.g. `npm run dev`.
 */

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface DesktopFile {
  path: string;
  name: string;
  data: Uint8Array;
}

/** What the auto-updater is doing (see electron/updater.cjs). */
export type UpdateStatus =
  | { status: 'idle' }
  | { status: 'unsupported'; reason: 'portable' | 'development' }
  | { status: 'checking'; manual?: boolean }
  | { status: 'latest'; manual?: boolean }
  | { status: 'downloading'; version: string; percent: number; manual?: boolean }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string; manual?: boolean };

interface RasterBridge {
  openFile(options: { filters?: FileFilter[] }): Promise<DesktopFile | null>;
  saveFile(options: {
    path?: string | null;
    defaultName: string;
    filters?: FileFilter[];
    data: Uint8Array;
  }): Promise<string | null>;
  setDirty(dirty: boolean): void;
  onOpenFile(callback: (file: DesktopFile) => void): void;
  checkForUpdates(manual: boolean): Promise<UpdateStatus>;
  getUpdateStatus(): Promise<UpdateStatus>;
  onUpdateStatus(callback: (status: UpdateStatus) => void): void;
  installUpdate(): void;
}

export const desktop: RasterBridge | undefined =
  typeof window === 'undefined' ? undefined : (window as { raster?: RasterBridge }).raster;

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
