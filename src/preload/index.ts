// Exposes a small, explicit API to the page as `window.raster`. The page has
// no Node access; everything goes through these calls. Built as CommonJS,
// because sandboxed preload scripts can't be ES modules.
import { contextBridge, ipcRenderer } from 'electron';
import type { RasterApi } from '@shared/api';
import type { EventChannels, InvokeChannels, SendChannels } from '@shared/ipc';

const invoke = <C extends keyof InvokeChannels>(
  channel: C,
  ...args: Parameters<InvokeChannels[C]>
) => ipcRenderer.invoke(channel, ...args) as Promise<ReturnType<InvokeChannels[C]>>;

const send = <C extends keyof SendChannels>(channel: C, ...args: Parameters<SendChannels[C]>) =>
  ipcRenderer.send(channel, ...args);

const listen = <C extends keyof EventChannels>(channel: C, listener: EventChannels[C]) => {
  const callback = listener as (...args: unknown[]) => void;
  ipcRenderer.on(channel, (_event, ...args: unknown[]) => callback(...args));
};

const api: RasterApi = {
  openFile: (options) => invoke('file:open', options),
  saveFile: (options) => invoke('file:save', options),
  setDirty: (dirty) => send('doc:dirty', dirty),
  checkForUpdates: (manual) => invoke('update:check', { manual }),
  getUpdateStatus: () => invoke('update:state'),
  onUpdateStatus: (callback) => listen('update:status', callback),
  installUpdate: () => send('update:install'),
  onOpenFile: (callback) => {
    listen('file:opened', callback);
    send('app:ready');
  },
  getSettings: () => invoke('settings:get'),
  updateSettings: (patch) => invoke('settings:set', patch),
  getRecentFiles: () => invoke('recent:list'),
  openRecentFile: (path) => invoke('recent:open', path),
  clearRecentFiles: () => send('recent:clear'),
};

contextBridge.exposeInMainWorld('raster', api);
