import type { Editor } from '@editor/editor';
import { desktop, type UpdateStatus } from '@platform/desktop';
import { getSettings } from '@platform/settings';

/**
 * Automatic updates, renderer side: tracks the updater's status for the UI,
 * checks on launch (unless turned off in Preferences) and turns manual checks
 * into messages.
 */

let status: UpdateStatus = desktop
  ? { status: 'idle' }
  : { status: 'unsupported', reason: 'development' };
const listeners = new Set<() => void>();

export const getUpdateStatus = (): UpdateStatus => status;

export function subscribeUpdates(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Describes a status for a manual check, or null when there's nothing to say. */
export function describeUpdate(s: UpdateStatus): string | null {
  switch (s.status) {
    case 'checking':
      return 'Checking for updates…';
    case 'latest':
      return `Raster ${__APP_VERSION__} is the latest version`;
    case 'downloading':
      return `Downloading Raster ${s.version}… ${s.percent}%`;
    case 'ready':
      return `Raster ${s.version} is ready to install`;
    case 'error':
      return "Couldn't check for updates. Check your connection and try again.";
    case 'unsupported':
      return s.reason === 'portable'
        ? 'The portable version doesn’t update itself. Download the new version from GitHub Releases.'
        : 'Updates work in the installed app.';
    default:
      return null;
  }
}

/** Starts listening to the updater and, if enabled, checks once at launch. */
export function startUpdates(editor: Editor): void {
  if (!desktop) return;
  const bridge = desktop;
  bridge.onUpdateStatus((next) => {
    status = next;
    for (const fn of listeners) fn();
    // Only checks the user asked for get a message for every step; automatic
    // checks stay quiet until an update is ready (the banner shows it).
    if ('manual' in next && next.manual) {
      const text = describeUpdate(next);
      if (text) editor.notify(text);
    }
  });
  void bridge.getUpdateStatus().then((s) => {
    status = s;
    for (const fn of listeners) fn();
    if (getSettings().checkUpdates && s.status === 'idle') void bridge.checkForUpdates(false);
  });
}

/** Help › Check for Updates. */
export async function checkForUpdates(editor: Editor): Promise<void> {
  if (!desktop) {
    editor.notify(describeUpdate(status) ?? '');
    return;
  }
  const result = await desktop.checkForUpdates(true);
  // Unsupported builds and in-progress downloads don't emit new events.
  if (
    result.status === 'unsupported' ||
    result.status === 'downloading' ||
    result.status === 'ready'
  ) {
    const text = describeUpdate(result);
    if (text) editor.notify(text);
  }
}

export function installUpdate(): void {
  desktop?.installUpdate();
}
