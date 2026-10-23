// Automatic updates from GitHub Releases, for the installed (Setup) build.
// The portable .exe and development runs can't update themselves; they report
// "unsupported" so the page can explain what to do instead.
import { app, type BrowserWindow } from 'electron';
// electron-updater is CommonJS: take the default export, then the updater.
import electronUpdater, { type AppUpdater } from 'electron-updater';
import type { UpdateStatus } from '@shared/api';
import { emit, handle, on } from './ipc';

export function setupUpdates(getWindow: () => BrowserWindow | null): void {
  const portable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
  const supported = app.isPackaged && !portable;
  let updater: AppUpdater | null = null;
  let manual = false;
  let version = '';
  let state: UpdateStatus = supported
    ? { status: 'idle' }
    : { status: 'unsupported', reason: portable ? 'portable' : 'development' };

  const send = (next: UpdateStatus) => {
    state = next;
    const win = getWindow();
    if (win && !win.isDestroyed()) emit(win.webContents, 'update:status', state);
  };

  if (supported) {
    updater = electronUpdater.autoUpdater;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.logger = null;
    updater.on('checking-for-update', () => send({ status: 'checking', manual }));
    updater.on('update-available', (info) => {
      version = info.version;
      send({ status: 'downloading', version, percent: 0, manual });
    });
    updater.on('download-progress', (p) =>
      send({ status: 'downloading', version, percent: Math.round(p.percent), manual }),
    );
    updater.on('update-not-available', () => send({ status: 'latest', manual }));
    updater.on('update-downloaded', (info) => send({ status: 'ready', version: info.version }));
    updater.on('error', (err) =>
      send({ status: 'error', message: String(err?.message || err), manual }),
    );
  }

  handle('update:check', async (_event, options) => {
    if (!updater) return state;
    // A download in progress or waiting to install needs no new check.
    if (state.status === 'downloading' || state.status === 'ready') return state;
    manual = Boolean(options?.manual);
    try {
      await updater.checkForUpdates();
    } catch {
      // Reported through the 'error' event.
    }
    return state;
  });

  handle('update:state', () => state);

  // Quits and runs the installer, which reopens Raster when it finishes. The
  // window's unsaved-changes warning still applies.
  on('update:install', () => {
    if (updater && state.status === 'ready') updater.quitAndInstall(false, true);
  });
}
