/**
 * The API the preload script exposes to the page as `window.raster`. Shared by
 * the main process, the preload script and the renderer, so it holds types
 * only: no Node, no DOM.
 */

import type { RecentFile, Settings } from './settings';

export type { RecentFile, Settings } from './settings';

export interface FileFilter {
  name: string;
  extensions: string[];
}

/** A file read from disk by the main process. */
export interface DesktopFile {
  path: string;
  name: string;
  data: Uint8Array;
}

export interface OpenFileOptions {
  filters?: FileFilter[];
}

export interface SaveFileOptions {
  /** Overwrites this path if Raster opened or saved it before; otherwise asks. */
  path?: string | null;
  defaultName: string;
  filters?: FileFilter[];
  data: Uint8Array;
}

/** What the auto-updater is doing (see src/main/updater.ts). */
export type UpdateStatus =
  | { status: 'idle' }
  | { status: 'unsupported'; reason: 'portable' | 'development' }
  | { status: 'checking'; manual?: boolean }
  | { status: 'latest'; manual?: boolean }
  | { status: 'downloading'; version: string; percent: number; manual?: boolean }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string; manual?: boolean };

export interface RasterApi {
  /** Shows a native open dialog. Resolves to the file, or null if cancelled. */
  openFile(options: OpenFileOptions): Promise<DesktopFile | null>;
  /** Writes `data` to `path` (if trusted) or asks where. Resolves to the path or null. */
  saveFile(options: SaveFileOptions): Promise<string | null>;
  /** Tells the app whether there are unsaved changes, for the quit warning. */
  setDirty(dirty: boolean): void;
  /** Receives files the OS asked Raster to open. Call once, when ready. */
  onOpenFile(callback: (file: DesktopFile) => void): void;
  /** Checks GitHub for a newer version; it downloads in the background. */
  checkForUpdates(manual: boolean): Promise<UpdateStatus>;
  /** The updater's current status. */
  getUpdateStatus(): Promise<UpdateStatus>;
  /** Receives updater status changes. */
  onUpdateStatus(callback: (status: UpdateStatus) => void): void;
  /** Quits and installs a downloaded update, then reopens Raster. */
  installUpdate(): void;
  /** The saved preferences. */
  getSettings(): Promise<Settings>;
  /** Saves some preferences; resolves to all of them, validated. */
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  /** Files opened or saved recently that still exist, newest first. */
  getRecentFiles(): Promise<RecentFile[]>;
  /** Reads a recent file. Resolves to null if it's gone or not in the list. */
  openRecentFile(path: string): Promise<DesktopFile | null>;
  clearRecentFiles(): void;
}
