// Preferences, recent files and saved palettes, kept in settings.json in the
// user-data folder.
// Everything read from disk or sent by the page is validated (see
// src/shared/settings.ts); writes go through a temp file so a crash mid-write
// can't corrupt the file.
import { app } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  addRecent,
  DEFAULT_SETTINGS,
  MAX_SAVED_PALETTES,
  sanitizePalette,
  sanitizePalettes,
  sanitizeRecent,
  sanitizeSettings,
  upsertPalette,
  type RecentFile,
  type SavedPalette,
  type Settings,
} from '@shared/settings';
import { handle, on } from './ipc';

interface Stored {
  settings: Settings;
  recent: RecentFile[];
  palettes: SavedPalette[];
}

let data: Stored | null = null;
let writing: Promise<void> = Promise.resolve();

const storeFile = () => join(app.getPath('userData'), 'settings.json');

function load(): Stored {
  if (data) return data;
  try {
    const raw = JSON.parse(readFileSync(storeFile(), 'utf8'));
    data = {
      settings: sanitizeSettings(raw?.settings),
      recent: sanitizeRecent(raw?.recent),
      palettes: sanitizePalettes(raw?.palettes),
    };
  } catch {
    data = { settings: { ...DEFAULT_SETTINGS }, recent: [], palettes: [] };
  }
  return data;
}

function save(): void {
  const json = JSON.stringify(load(), null, 2);
  const target = storeFile();
  writing = writing
    .then(async () => {
      await writeFile(`${target}.tmp`, json);
      await rename(`${target}.tmp`, target);
    })
    .catch(() => {
      // Not saved; the in-memory copy still applies for this session.
    });
}

export const getSettings = (): Settings => load().settings;

export function updateSettings(patch: unknown): Settings {
  const d = load();
  d.settings = sanitizeSettings(patch, d.settings);
  save();
  return d.settings;
}

/** Recent files that still exist, newest first. */
export function getRecent(): RecentFile[] {
  const d = load();
  const live = d.recent.filter((f) => existsSync(f.path));
  if (live.length !== d.recent.length) {
    d.recent = live;
    save();
  }
  return live;
}

export const isRecent = (path: string): boolean =>
  load().recent.some((f) => f.path.toLowerCase() === path.toLowerCase());

export function rememberRecent(path: string): void {
  const d = load();
  d.recent = addRecent(d.recent, { path, name: basename(path), openedAt: Date.now() });
  save();
  // Also shows in the taskbar jump list.
  app.addRecentDocument(path);
}

/** Adds a palette to the library, or replaces the one with the same id. */
export function savePalette(input: unknown): SavedPalette[] {
  const palette = sanitizePalette(input);
  if (!palette) throw new Error('Invalid palette');
  const d = load();
  const next = upsertPalette(d.palettes, palette);
  if (!next) throw new Error(`The palette library is full (${MAX_SAVED_PALETTES} palettes)`);
  d.palettes = next;
  save();
  return next;
}

export function deletePalette(id: unknown): SavedPalette[] {
  const d = load();
  const next = d.palettes.filter((p) => p.id !== id);
  if (next.length !== d.palettes.length) {
    d.palettes = next;
    save();
  }
  return d.palettes;
}

export function registerStoreHandlers(): void {
  handle('settings:get', () => getSettings());
  handle('settings:set', (_event, patch) => updateSettings(patch));
  handle('recent:list', () => getRecent());
  on('recent:clear', () => {
    load().recent = [];
    save();
    app.clearRecentDocuments();
  });
  handle('palettes:list', () => load().palettes);
  handle('palettes:save', (_event, palette) => savePalette(palette));
  handle('palettes:delete', (_event, id) => deletePalette(id));
}
