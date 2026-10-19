/** Installable-app plumbing: service worker, install prompt and OS file handling. */

/** Where the official build is hosted. */
export const APP_URL = 'https://j-isaac007.github.io/raster/';
export const INSTALL_GUIDE_URL = 'https://github.com/J-isaac007/raster/blob/main/docs/install.md';

/** Registers the offline service worker in production builds. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline support is optional; the app works without it.
    });
  });
}

// ---- install prompt -----------------------------------------------------------

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  /** Running as an installed app rather than in a browser tab. */
  installed: boolean;
  /** The browser offered a one-click install (Chromium browsers). */
  canPrompt: boolean;
}

let deferred: InstallPromptEvent | null = null;
let installState: InstallState = { installed: false, canPrompt: false };
const listeners = new Set<() => void>();

function setInstallState(patch: Partial<InstallState>) {
  installState = { ...installState, ...patch };
  for (const fn of listeners) fn();
}

/** Starts listening for install events. Call once, early. */
export function trackInstall(): void {
  const standalone = window.matchMedia?.('(display-mode: standalone)');
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
  setInstallState({ installed: !!standalone?.matches || iosStandalone });
  standalone?.addEventListener('change', (e) => setInstallState({ installed: e.matches }));

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // We show our own button in Help › Install Raster.
    deferred = e as InstallPromptEvent;
    setInstallState({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    setInstallState({ installed: true, canPrompt: false });
  });
}

export const getInstallState = (): InstallState => installState;

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Shows the browser's install prompt. Resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  setInstallState({ canPrompt: false });
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}

// ---- platform-specific instructions ------------------------------------------

export type InstallPlatform =
  | 'desktop-chromium'
  | 'desktop-edge'
  | 'desktop-safari'
  | 'desktop-firefox'
  | 'android-chrome'
  | 'android-samsung'
  | 'android-firefox'
  | 'ios'
  | 'other';

/** Best guess at the user's device and browser, from the user agent. */
export function detectPlatform(ua = navigator.userAgent): InstallPlatform {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return 'ios';
  if (/Android/.test(ua)) {
    if (/SamsungBrowser/.test(ua)) return 'android-samsung';
    if (/Firefox/.test(ua)) return 'android-firefox';
    return 'android-chrome';
  }
  if (/Firefox/.test(ua)) return 'desktop-firefox';
  if (/Edg\//.test(ua)) return 'desktop-edge';
  if (/Chrome|Chromium|CriOS/.test(ua)) return 'desktop-chromium';
  if (/Safari/.test(ua) && /Macintosh/.test(ua)) return 'desktop-safari';
  return 'other';
}

export const INSTALL_STEPS: Record<InstallPlatform, { label: string; steps: string[] }> = {
  'desktop-chromium': {
    label: 'Chrome on Windows, macOS, Linux or ChromeOS',
    steps: [
      'Click the install icon at the right end of the address bar.',
      'Or open the ⋮ menu and choose Install Raster (in recent versions it’s under Cast, save and share).',
      'Raster opens in its own window and gets a Start menu, Dock or launcher icon.',
    ],
  },
  'desktop-edge': {
    label: 'Microsoft Edge on Windows, macOS or Linux',
    steps: [
      'Click the install icon at the right end of the address bar.',
      'Or open the ⋯ menu and choose Apps › Install Raster.',
      'Raster opens in its own window and can be pinned to the taskbar.',
    ],
  },
  'desktop-safari': {
    label: 'Safari on macOS (Sonoma or later)',
    steps: [
      'In the menu bar, choose File › Add to Dock.',
      'Click Add. Raster appears in the Dock and Launchpad.',
    ],
  },
  'desktop-firefox': {
    label: 'Firefox on desktop',
    steps: [
      'Firefox can’t install web apps on most systems.',
      'Open this page in Chrome or Edge to install it, or keep using it in a Firefox tab. It works the same, offline included.',
    ],
  },
  'android-chrome': {
    label: 'Chrome on Android',
    steps: [
      'Tap the ⋮ menu at the top right.',
      'Tap Add to home screen, then Install.',
      'Raster appears in your app drawer like any other app. No APK download needed.',
    ],
  },
  'android-samsung': {
    label: 'Samsung Internet',
    steps: ['Tap the ≡ menu.', 'Tap Add page to › Home screen, then Add.'],
  },
  'android-firefox': {
    label: 'Firefox on Android',
    steps: ['Tap the ⋮ menu.', 'Tap Add app to Home screen (or Install), then confirm.'],
  },
  ios: {
    label: 'iPhone or iPad',
    steps: [
      'Open this page in Safari (or any browser on iOS 16.4 or later).',
      'Tap the Share button.',
      'Tap Add to Home Screen, then Add.',
    ],
  },
  other: {
    label: 'Your browser',
    steps: [
      'Look for Install or Add to home screen in your browser’s menu.',
      'If there isn’t one, open this page in Chrome, Edge or Safari.',
    ],
  },
};

// ---- OS file handling -------------------------------------------------------

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
