// Raster desktop: the Electron main process. It owns the window and does the
// file work the page isn't allowed to do (native dialogs, reading, writing).
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const OPENABLE = /\.(raster|png|gif|webp|jpe?g|bmp)$/i;

/** @type {BrowserWindow | null} */
let win = null;
let dirty = false;
let rendererReady = false;
/** Files to open once the page is ready (from the command line or a second launch). */
const pendingOpens = [];
/**
 * Paths the user chose through a dialog or opened. The page may only write
 * to these, so a compromised page can't overwrite arbitrary files.
 */
const trustedPaths = new Set();

// ---- single instance --------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    queueOpens(argv.slice(1));
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

/** Picks openable files out of command-line arguments. */
function queueOpens(args) {
  for (const arg of args) {
    if (OPENABLE.test(arg) && fs.existsSync(arg)) pendingOpens.push(path.resolve(arg));
  }
  flushOpens();
}

async function flushOpens() {
  if (!win || !rendererReady) return;
  while (pendingOpens.length) {
    const file = await readForPage(pendingOpens.shift());
    if (file) win.webContents.send('file:opened', file);
  }
}

async function readForPage(filePath) {
  try {
    const data = await fsp.readFile(filePath);
    trustedPaths.add(filePath);
    return { path: filePath, name: path.basename(filePath), data };
  } catch {
    return null;
  }
}

// ---- window state -----------------------------------------------------------

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return { width: 1400, height: 900 };
  }
}

function saveWindowState() {
  if (!win) return;
  const state = { ...win.getNormalBounds(), maximized: win.isMaximized() };
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(state));
  } catch {
    // Not worth failing over.
  }
}

// ---- window -----------------------------------------------------------------

function createWindow() {
  const state = loadWindowState();
  const devIcon = path.join(__dirname, '..', 'build', 'icon.png');
  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 900,
    minHeight: 600,
    title: 'Raster',
    backgroundColor: '#15161b',
    show: false,
    icon: fs.existsSync(devIcon) ? devIcon : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  if (state.maximized) win.maximize();

  // Raster draws its own menu bar.
  Menu.setApplicationMenu(null);

  win.once('ready-to-show', () => win.show());
  win.on('close', (event) => {
    saveWindowState();
    if (!dirty) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Quit', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Raster',
      message: 'Quit with unsaved changes?',
      detail:
        'Your sprite is autosaved and will be back next time you open Raster, but it hasn’t been saved to a file.',
    });
    if (choice === 1) event.preventDefault();
  });
  win.on('closed', () => {
    win = null;
    rendererReady = false;
  });

  // Links open in the default browser; the window never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return;
    event.preventDefault();
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });

  win.webContents.on('before-input-event', (_event, input) => {
    const devTools = input.key === 'F12' || (input.control && input.shift && input.key === 'I');
    if (input.type === 'keyDown' && devTools && (DEV_URL || !app.isPackaged)) {
      win.webContents.toggleDevTools();
    }
  });

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// ---- IPC ----------------------------------------------------------------------

ipcMain.handle('file:open', async (_event, { filters } = {}) => {
  const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
  if (result.canceled || !result.filePaths[0]) return null;
  return readForPage(result.filePaths[0]);
});

ipcMain.handle('file:save', async (_event, { path: target, defaultName, filters, data }) => {
  if (target && !trustedPaths.has(target)) target = null;
  if (!target) {
    const result = await dialog.showSaveDialog(win, {
      defaultPath: path.join(app.getPath('documents'), defaultName || 'untitled'),
      filters,
    });
    if (result.canceled || !result.filePath) return null;
    target = result.filePath;
  }
  await fsp.writeFile(target, Buffer.from(data));
  trustedPaths.add(target);
  return target;
});

ipcMain.on('doc:dirty', (_event, value) => {
  dirty = Boolean(value);
});

ipcMain.on('app:ready', () => {
  rendererReady = true;
  flushOpens();
});

// ---- lifecycle ----------------------------------------------------------------

app.setAppUserModelId('io.github.jisaac007.raster');

app.whenReady().then(() => {
  queueOpens(process.argv.slice(app.isPackaged ? 1 : 2));
  createWindow();
});

app.on('window-all-closed', () => app.quit());
