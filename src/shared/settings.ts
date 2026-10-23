/**
 * User preferences and the recent-files list, stored by the main process in
 * `settings.json` in the app's user-data folder. Pure: shared by the main
 * process (which validates everything it reads or is sent) and the page.
 */

export const ACCENTS = ['blue', 'green', 'yellow', 'pink', 'purple', 'orange'] as const;
export type Accent = (typeof ACCENTS)[number];

export const CHECKER_SIZES = ['small', 'medium', 'large'] as const;
export type CheckerSize = (typeof CHECKER_SIZES)[number];

export interface Settings {
  /** Highlight color for selected tools, focus rings and primary buttons. */
  accent: Accent;
  /** Size of the transparency checkerboard behind the sprite. */
  checkerSize: CheckerSize;
  /** Pixel grid line color, `#rrggbb`. */
  gridColor: string;
  /** Show the pixel grid when zoomed in far enough. */
  showPixelGrid: boolean;
  /** Keep a copy of the open sprite so a crash or quit loses nothing. */
  autosave: boolean;
  /** Start with the last sprite instead of the welcome screen. */
  reopenLast: boolean;
  /** Check GitHub for a newer version when Raster starts. */
  checkUpdates: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  accent: 'blue',
  checkerSize: 'medium',
  gridColor: '#505464',
  showPixelGrid: true,
  autosave: true,
  reopenLast: true,
  checkUpdates: true,
};

const HEX = /^#[0-9a-f]{6}$/i;

const pick = <T>(value: unknown, valid: (v: unknown) => boolean, fallback: T): T =>
  valid(value) ? (value as T) : fallback;
const isBool = (v: unknown) => typeof v === 'boolean';
const oneOf = (list: readonly string[]) => (v: unknown) =>
  typeof v === 'string' && list.includes(v);

/**
 * Turns anything (a parsed file, an IPC payload) into valid settings, filling
 * missing or invalid fields from `base`. Unknown fields are dropped.
 */
export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const o = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    accent: pick(o.accent, oneOf(ACCENTS), base.accent),
    checkerSize: pick(o.checkerSize, oneOf(CHECKER_SIZES), base.checkerSize),
    gridColor: pick<string>(
      o.gridColor,
      (v) => typeof v === 'string' && HEX.test(v),
      base.gridColor,
    ).toLowerCase(),
    showPixelGrid: pick(o.showPixelGrid, isBool, base.showPixelGrid),
    autosave: pick(o.autosave, isBool, base.autosave),
    reopenLast: pick(o.reopenLast, isBool, base.reopenLast),
    checkUpdates: pick(o.checkUpdates, isBool, base.checkUpdates),
  };
}

/** A file Raster opened or saved, newest first in the list. */
export interface RecentFile {
  path: string;
  name: string;
  /** Milliseconds since the epoch. */
  openedAt: number;
}

export const MAX_RECENT = 10;

/** Moves (or adds) `file` to the top of the list, keeping it short and free of duplicates. */
export function addRecent(list: readonly RecentFile[], file: RecentFile): RecentFile[] {
  const same = (p: string) => p.toLowerCase() === file.path.toLowerCase();
  return [file, ...list.filter((f) => !same(f.path))].slice(0, MAX_RECENT);
}

/** Keeps only well-formed entries, newest first, at most MAX_RECENT. */
export function sanitizeRecent(input: unknown): RecentFile[] {
  if (!Array.isArray(input)) return [];
  const ok = input.filter(
    (f): f is RecentFile =>
      !!f &&
      typeof f.path === 'string' &&
      f.path.length > 0 &&
      typeof f.name === 'string' &&
      typeof f.openedAt === 'number',
  );
  return ok.sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX_RECENT);
}
