// Preferences and recent files, kept in settings.json in the user-data folder.
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
  sanitizeRecent,
  sanitizeSettings,
  type RecentFile,
  type Settings,
} from '@shared/settings';
import { handle, on } from './ipc';

interface Stored {
  settings: Settings;
  recent: RecentFile[];
}

let data: Stored | null = null;
let writing: Promise<void> = Promise.resolve();

const storeFile = () => join(app.getPath('userData'), 'settings.json');

function load(): Stored {
  if (data) return data;
  try {
    const raw = JSON.parse(readFileSync(storeFile(), 'utf8'));
    data = { settings: sanitizeSettings(raw?.settings), recent: sanitizeRecent(raw?.recent) };
  } catch {
    data = { settings: { ...DEFAULT_SETTINGS }, recent: [] };
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

export function registerStoreHandlers(): void {
  handle('settings:get', () => getSettings());
  handle('settings:set', (_event, patch) => updateSettings(patch));
  handle('recent:list', () => getRecent());
  on('recent:clear', () => {
    load().recent = [];
    save();
    app.clearRecentDocuments();
  });
}
