// Native open/save dialogs and files the OS asks Raster to open. The page can
// only overwrite paths the user picked or opened in this session (trusted
// paths); anything else goes through a save dialog.
import { app, BrowserWindow, dialog, type WebContents } from 'electron';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { DesktopFile } from '@shared/api';
import { emit, handle, on } from './ipc';
import { isRecent, rememberRecent } from './store';

/** Files Raster opens as a sprite; these go in the recent list when opened. */
const OPENABLE = /\.(raster|png|gif|webp|jpe?g|bmp)$/i;
const PROJECT = /\.raster$/i;

const trustedPaths = new Set<string>();
const pendingOpens: string[] = [];
/** The page that said it's ready for files, once it has. */
let page: WebContents | null = null;

/** Queues files from a command line (first launch or a second instance). */
export function queueOpens(args: string[]): void {
  for (const arg of args) {
    if (OPENABLE.test(arg) && existsSync(arg)) pendingOpens.push(resolve(arg));
  }
  void flushOpens();
}

async function flushOpens(): Promise<void> {
  while (page && !page.isDestroyed() && pendingOpens.length) {
    const file = await readForPage(pendingOpens.shift()!);
    if (file && page) emit(page, 'file:opened', file);
  }
}

async function readForPage(filePath: string): Promise<DesktopFile | null> {
  try {
    const data = await readFile(filePath);
    trustedPaths.add(filePath);
    // Palettes and other side files open through the same dialog; only
    // sprites count as recent.
    if (OPENABLE.test(filePath)) rememberRecent(filePath);
    return { path: filePath, name: basename(filePath), data };
  } catch {
    return null;
  }
}

export function registerFileHandlers(): void {
  handle('file:open', async (event, options) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: options?.filters,
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || !result.filePaths[0]) return null;
    return readForPage(result.filePaths[0]);
  });

  handle('file:save', async (event, options) => {
    if (!options) return null;
    let target = options.path && trustedPaths.has(options.path) ? options.path : null;
    if (!target) {
      const parent = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions: Electron.SaveDialogOptions = {
        defaultPath: join(app.getPath('documents'), options.defaultName || 'untitled'),
        filters: options.filters,
      };
      const result = parent
        ? await dialog.showSaveDialog(parent, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);
      if (result.canceled || !result.filePath) return null;
      target = result.filePath;
    }
    await writeFile(target, Buffer.from(options.data));
    trustedPaths.add(target);
    // Exports are saved this way too; only projects count as recent.
    if (PROJECT.test(target)) rememberRecent(target);
    return target;
  });

  handle('recent:open', (_event, path) =>
    typeof path === 'string' && isRecent(path) ? readForPage(path) : null,
  );

  on('app:ready', (event) => {
    page = event.sender;
    void flushOpens();
  });
}
