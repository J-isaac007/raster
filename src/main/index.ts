// Raster's main process: one instance, one window. Files passed on the
// command line (double-clicked .raster files, "Open with") go to that window.
import { app } from 'electron';
import { queueOpens, registerFileHandlers } from './files';
import { registerStoreHandlers } from './store';
import { setupUpdates } from './updater';
import { createMainWindow, focusMainWindow, getMainWindow, registerWindowHandlers } from './window';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    queueOpens(argv.slice(1));
    focusMainWindow();
  });

  app.setAppUserModelId('io.github.jisaac007.raster');
  registerFileHandlers();
  registerStoreHandlers();
  registerWindowHandlers();

  void app.whenReady().then(() => {
    // `electron .` in development adds the app path to argv.
    queueOpens(process.argv.slice(app.isPackaged ? 1 : 2));
    setupUpdates(getMainWindow);
    createMainWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
