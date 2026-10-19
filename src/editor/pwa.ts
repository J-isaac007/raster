/** Installable-app plumbing: service worker and OS file handling. */

/** Registers the offline service worker in production builds. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline support is optional; the app works without it.
    });
  });
}

interface LaunchParams {
  files: { getFile(): Promise<File> }[];
}

interface LaunchQueueWindow {
  launchQueue?: { setConsumer(consumer: (params: LaunchParams) => void): void };
}

/**
 * Calls `open` with files the OS asked the installed app to open
 * (double-clicking a `.raster` file, "Open with Raster", ...).
 */
export function handleLaunchFiles(open: (file: File) => void): void {
  const queue = (window as LaunchQueueWindow).launchQueue;
  queue?.setConsumer(async ({ files }) => {
    const handle = files[0];
    if (handle) open(await handle.getFile());
  });
}
