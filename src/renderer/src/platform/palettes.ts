import { sanitizePalette, upsertPalette, type SavedPalette } from '@shared/settings';
import { desktop } from './desktop';

export type { SavedPalette } from '@shared/settings';

/**
 * The user's palette library ("My palettes"), as the main process keeps it.
 * Outside Electron (unit tests) it lives in memory only.
 */

let palettes: SavedPalette[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const set = (list: SavedPalette[]) => {
  palettes = list;
  notify();
};

export const getSavedPalettes = (): SavedPalette[] => palettes;

export function subscribeSavedPalettes(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-reads the library from disk; call once at startup. */
export async function refreshSavedPalettes(): Promise<void> {
  if (!desktop) return;
  try {
    set(await desktop.getPalettes());
  } catch {
    // Keep the last list.
  }
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** A new, unsaved palette with a fresh id; pass it to `savePalette`. */
export const newSavedPalette = (name: string, colors: readonly string[]): SavedPalette => ({
  id: newId(),
  name,
  colors: [...colors],
  createdAt: Date.now(),
});

/**
 * Adds a palette, or replaces the one with the same id. Colors may be
 * `#rrggbb` or `#rrggbbaa`. False if it's invalid (no usable colors), the
 * library is full, or it couldn't be saved.
 */
export async function savePalette(palette: SavedPalette): Promise<boolean> {
  const clean = sanitizePalette(palette);
  if (!clean) return false;
  if (!desktop) {
    const next = upsertPalette(palettes, clean);
    if (next) set(next);
    return !!next;
  }
  try {
    set(await desktop.savePalette(clean));
    return true;
  } catch {
    return false;
  }
}

export async function deletePalette(id: string): Promise<void> {
  if (!desktop) {
    set(palettes.filter((p) => p.id !== id));
    return;
  }
  try {
    set(await desktop.deletePalette(id));
  } catch {
    // Keep the last list.
  }
}
