// The editor window: size and position kept between runs, locked-down web
// preferences, links opened in the browser, and a warning before quitting
// with unsaved changes.
import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { on } from './ipc';

/** Set by `electron-vite dev`; the packaged app loads its own files instead. */
const DEV_URL = process.env.ELECTRON_RENDERER_URL;

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized?: boolean;
}

let win: BrowserWindow | null = null;
let dirty = false;

export const getMainWindow = (): BrowserWindow | null => win;

export function focusMainWindow(): void {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
}

const stateFile = () => join(app.getPath('userData'), 'window-state.json');

function loadWindowState(): WindowState {
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8')) as WindowState;
  } catch {
    return { width: 1400, height: 900 };
  }
}

function saveWindowState(window: BrowserWindow): void {
  const state: WindowState = { ...window.getNormalBounds(), maximized: window.isMaximized() };
  try {
    writeFileSync(stateFile(), JSON.stringify(state));
  } catch {
    // Not worth bothering anyone about.
  }
}

export function registerWindowHandlers(): void {
  on('doc:dirty', (_event, value) => {
    dirty = Boolean(value);
  });
}

export function createMainWindow(): BrowserWindow {
  const state = loadWindowState();
  // The packaged exe carries its own icon; development runs borrow the source.
  const devIcon = join(app.getAppPath(), 'build', 'icon.png');
  const window = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 900,
    minHeight: 600,
    title: 'Raster',
    backgroundColor: '#15161b',
    show: false,
    icon: existsSync(devIcon) ? devIcon : undefined,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win = window;
  if (state.maximized) window.maximize();

  Menu.setApplicationMenu(null);
  window.once('ready-to-show', () => window.show());

  window.on('close', (event) => {
    saveWindowState(window);
    if (!dirty) return;
    const choice = dialog.showMessageBoxSync(window, {
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
  window.on('closed', () => {
    win = null;
  });

  // Links open in the browser; the window itself never navigates away.
  const contents = window.webContents;
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (url === contents.getURL()) return;
    event.preventDefault();
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  });

  // DevTools only in development.
  contents.on('before-input-event', (_event, input) => {
    const devTools = input.key === 'F12' || (input.control && input.shift && input.key === 'I');
    if (input.type === 'keyDown' && devTools && (DEV_URL || !app.isPackaged)) {
      contents.toggleDevTools();
    }
  });

  if (DEV_URL) void window.loadURL(DEV_URL);
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  return window;
}
