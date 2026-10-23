import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '@shared/settings';
import { desktop } from './desktop';

/**
 * The page's copy of the preferences the main process stores. Reads are
 * synchronous (call `loadSettings` once at startup); writes apply at once and
 * are saved in the background. Without the desktop bridge (tests) they live
 * in memory only.
 */

let current: Settings = { ...DEFAULT_SETTINGS };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const getSettings = (): Settings => current;

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fetches the saved preferences. Never throws; falls back to defaults. */
export async function loadSettings(): Promise<Settings> {
  try {
    if (desktop) current = sanitizeSettings(await desktop.getSettings());
  } catch {
    // Defaults apply.
  }
  notify();
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = sanitizeSettings(patch, current);
  notify();
  desktop
    ?.updateSettings(patch)
    .then((saved) => {
      current = sanitizeSettings(saved);
      notify();
    })
    .catch(() => {
      // Kept for this session only.
    });
}
