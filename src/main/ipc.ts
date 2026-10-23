// Typed wrappers over ipcMain and webContents.send, limited to the channels in
// src/shared/ipc.ts. Arguments come from the page, so handlers still treat
// them as untrusted.
import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron';
import type { EventChannels, InvokeChannels, SendChannels } from '@shared/ipc';

type Awaitable<T> = T | Promise<T>;

export function handle<C extends keyof InvokeChannels>(
  channel: C,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: Partial<Parameters<InvokeChannels[C]>>
  ) => Awaitable<ReturnType<InvokeChannels[C]>>,
): void {
  ipcMain.handle(channel, (event, ...args) =>
    handler(event, ...(args as Partial<Parameters<InvokeChannels[C]>>)),
  );
}

export function on<C extends keyof SendChannels>(
  channel: C,
  listener: (event: IpcMainEvent, ...args: Partial<Parameters<SendChannels[C]>>) => void,
): void {
  ipcMain.on(channel, (event, ...args) =>
    listener(event, ...(args as Partial<Parameters<SendChannels[C]>>)),
  );
}

export function emit<C extends keyof EventChannels>(
  contents: WebContents,
  channel: C,
  ...args: Parameters<EventChannels[C]>
): void {
  if (!contents.isDestroyed()) contents.send(channel, ...args);
}
