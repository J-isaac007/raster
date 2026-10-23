/**
 * The IPC contract between the main process and the preload script: every
 * channel, its arguments and its result, in one place. `src/main/ipc.ts` and
 * `src/preload/index.ts` only accept channels listed here.
 */
import type { DesktopFile, OpenFileOptions, SaveFileOptions, UpdateStatus } from './api';
import type { RecentFile, Settings } from './settings';

/** Page → main, with a reply (`ipcRenderer.invoke` / `ipcMain.handle`). */
export interface InvokeChannels {
  'file:open': (options: OpenFileOptions) => DesktopFile | null;
  'file:save': (options: SaveFileOptions) => string | null;
  'update:check': (options: { manual: boolean }) => UpdateStatus;
  'update:state': () => UpdateStatus;
  'settings:get': () => Settings;
  'settings:set': (patch: Partial<Settings>) => Settings;
  'recent:list': () => RecentFile[];
  /** Reads a file from the recent list; any other path is refused. */
  'recent:open': (path: string) => DesktopFile | null;
}

/** Page → main, fire and forget (`ipcRenderer.send` / `ipcMain.on`). */
export interface SendChannels {
  'doc:dirty': (dirty: boolean) => void;
  'app:ready': () => void;
  'update:install': () => void;
  'recent:clear': () => void;
}

/** Main → page (`webContents.send` / `ipcRenderer.on`). */
export interface EventChannels {
  'file:opened': (file: DesktopFile) => void;
  'update:status': (status: UpdateStatus) => void;
}
