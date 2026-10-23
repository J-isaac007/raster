import type { RecentFile } from '@shared/settings';
import { desktop, toFile, type PickedFile } from './desktop';

/** Recently opened and saved files, as the main process keeps them. */

let recent: RecentFile[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const getRecentFiles = (): RecentFile[] => recent;

export function subscribeRecent(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-reads the list; call before showing it, since opening and saving change it. */
export async function refreshRecent(): Promise<void> {
  if (!desktop) return;
  try {
    recent = await desktop.getRecentFiles();
    notify();
  } catch {
    // Keep the last list.
  }
}

/** Reads a recent file, or null if it has gone missing. */
export async function readRecentFile(path: string): Promise<PickedFile | null> {
  const file = await desktop?.openRecentFile(path).catch(() => null);
  void refreshRecent();
  return file ? toFile(file) : null;
}

export function clearRecent(): void {
  desktop?.clearRecentFiles();
  recent = [];
  notify();
}
