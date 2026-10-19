// Automatic updates from GitHub Releases, for the installed (Setup) build.
// The portable .exe and development runs can't update themselves; they report
// "unsupported" so the page can explain what to do instead.
const { app, ipcMain } = require('electron');

/** @param {() => import('electron').BrowserWindow | null} getWindow */
function setupUpdates(getWindow) {
  const portable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
  const supported = app.isPackaged && !portable;
  let updater = null;
  let manual = false;
  let version = null;
  let state = supported
    ? { status: 'idle' }
    : { status: 'unsupported', reason: portable ? 'portable' : 'development' };

  const send = (next) => {
    state = next;
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('update:status', state);
  };

  if (supported) {
    ({ autoUpdater: updater } = require('electron-updater'));
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
      send({ status: 'error', message: String((err && err.message) || err), manual }),
    );
  }

  ipcMain.handle('update:check', async (_event, options = {}) => {
    if (!updater) return state;
    // A download in progress or waiting to install needs no new check.
    if (state.status === 'downloading' || state.status === 'ready') return state;
    manual = Boolean(options.manual);
    try {
      await updater.checkForUpdates();
    } catch {
      // Reported through the 'error' event.
    }
    return state;
  });

  ipcMain.handle('update:state', () => state);

  // Quits and runs the installer, which reopens Raster when it finishes. The
  // window's unsaved-changes warning still applies.
  ipcMain.on('update:install', () => {
    if (updater && state.status === 'ready') updater.quitAndInstall(false, true);
  });
}

module.exports = { setupUpdates };
