// Exposes a small, explicit API to the page as `window.raster`. The page has
// no Node access; everything goes through these calls.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('raster', {
  /** Shows a native open dialog. Resolves to { path, name, data } or null. */
  openFile: (options) => ipcRenderer.invoke('file:open', options),
  /** Writes `data` to `path` (if trusted) or asks where. Resolves to the path or null. */
  saveFile: (options) => ipcRenderer.invoke('file:save', options),
  /** Tells the app whether there are unsaved changes, for the quit warning. */
  setDirty: (dirty) => ipcRenderer.send('doc:dirty', dirty),
  /** Receives files the OS asked Raster to open. Call once, when ready. */
  onOpenFile: (callback) => {
    ipcRenderer.on('file:opened', (_event, file) => callback(file));
    ipcRenderer.send('app:ready');
  },
});
