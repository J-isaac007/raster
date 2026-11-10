import { describe, expect, it } from 'vitest';
import {
  addRecent,
  DEFAULT_SETTINGS,
  MAX_PALETTE_COLORS,
  MAX_RECENT,
  MAX_SAVED_PALETTES,
  sanitizePalette,
  sanitizePalettes,
  sanitizeRecent,
  sanitizeSettings,
  upsertPalette,
  type RecentFile,
  type SavedPalette,
} from './settings';

describe('sanitizeSettings', () => {
  it('fills missing fields with defaults', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ autosave: false })).toEqual({ ...DEFAULT_SETTINGS, autosave: false });
  });

  it('rejects invalid values and drops unknown fields', () => {
    const s = sanitizeSettings({
      accent: 'magenta',
      checkerSize: 'large',
      gridColor: 'red',
      showPixelGrid: 'yes',
      extra: 1,
    });
    expect(s.accent).toBe('blue');
    expect(s.checkerSize).toBe('large');
    expect(s.gridColor).toBe(DEFAULT_SETTINGS.gridColor);
    expect(s.showPixelGrid).toBe(DEFAULT_SETTINGS.showPixelGrid);
    expect('extra' in s).toBe(false);
  });

  it('applies a patch on top of current settings', () => {
    const current = { ...DEFAULT_SETTINGS, accent: 'pink' as const };
    expect(sanitizeSettings({ gridColor: '#AABBCC' }, current)).toEqual({
      ...current,
      gridColor: '#aabbcc',
    });
  });
});

describe('recent files', () => {
  const file = (path: string, openedAt: number): RecentFile => ({ path, name: path, openedAt });

  it('moves a reopened file to the top without duplicates', () => {
    const list = [file('a', 3), file('b', 2), file('c', 1)];
    expect(addRecent(list, file('B', 4)).map((f) => f.path)).toEqual(['B', 'a', 'c']);
  });

  it('keeps at most MAX_RECENT entries', () => {
    let list: RecentFile[] = [];
    for (let i = 0; i < MAX_RECENT + 5; i++) list = addRecent(list, file(`f${i}`, i));
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0].path).toBe(`f${MAX_RECENT + 4}`);
  });

  it('sanitizes a stored list', () => {
    expect(sanitizeRecent('nope')).toEqual([]);
    expect(sanitizeRecent([file('a', 1), { path: 3 }, file('b', 2)]).map((f) => f.path)).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('saved palettes', () => {
  const pal = (id: string, createdAt: number, colors = ['#000000ff']): SavedPalette => ({
    id,
    name: id,
    colors,
    createdAt,
  });

  it('normalizes colors to lowercase #rrggbbaa and drops bad ones', () => {
    const p = sanitizePalette({
      id: 'a',
      name: 'Mine',
      colors: ['#AABBCC', '#11223344', 'red', '#abc', 5, '#1234567'],
      createdAt: 1,
    });
    expect(p).toEqual({ id: 'a', name: 'Mine', colors: ['#aabbccff', '#11223344'], createdAt: 1 });
  });

  it('trims and shortens the name, naming blank ones', () => {
    expect(sanitizePalette({ ...pal('a', 1), name: `  ${'x'.repeat(80)}  ` })?.name).toBe(
      'x'.repeat(60),
    );
    expect(sanitizePalette({ ...pal('a', 1), name: '   ' })?.name).toBe('Untitled');
    expect(sanitizePalette({ ...pal('a', 1), name: 7 })?.name).toBe('Untitled');
  });

  it('rejects malformed palettes', () => {
    expect(sanitizePalette(null)).toBeNull();
    expect(sanitizePalette('x')).toBeNull();
    expect(sanitizePalette({ ...pal('a', 1), id: '' })).toBeNull();
    expect(sanitizePalette({ ...pal('a', 1), id: 3 })).toBeNull();
    expect(sanitizePalette({ ...pal('a', 1), createdAt: NaN })).toBeNull();
    expect(sanitizePalette({ ...pal('a', 1), colors: 'nope' })).toBeNull();
    expect(sanitizePalette({ ...pal('a', 1), colors: ['bad'] })).toBeNull();
  });

  it('caps the number of colors', () => {
    const colors = Array.from({ length: MAX_PALETTE_COLORS + 10 }, () => '#ffffff');
    expect(sanitizePalette(pal('a', 1, colors))?.colors).toHaveLength(MAX_PALETTE_COLORS);
  });

  it('sanitizes a stored list: newest first, unique ids, capped', () => {
    expect(sanitizePalettes(undefined)).toEqual([]);
    const list = sanitizePalettes([pal('a', 1), { id: 'bad' }, pal('b', 3), pal('a', 2)]);
    expect(list.map((p) => [p.id, p.createdAt])).toEqual([
      ['b', 3],
      ['a', 2],
    ]);
    const many = Array.from({ length: MAX_SAVED_PALETTES + 5 }, (_, i) => pal(`p${i}`, i));
    expect(sanitizePalettes(many)).toHaveLength(MAX_SAVED_PALETTES);
  });

  it('adds, replaces by id, and refuses new palettes when full', () => {
    const list = [pal('b', 2), pal('a', 1)];
    expect(upsertPalette(list, pal('c', 3))?.map((p) => p.id)).toEqual(['c', 'b', 'a']);
    const renamed = { ...pal('a', 1), name: 'Renamed' };
    expect(upsertPalette(list, renamed)).toEqual([pal('b', 2), renamed]);

    const full = Array.from({ length: MAX_SAVED_PALETTES }, (_, i) => pal(`p${i}`, i));
    expect(upsertPalette(full, pal('new', 999))).toBeNull();
    expect(upsertPalette(full, { ...pal('p0', 0), name: 'x' })).toHaveLength(MAX_SAVED_PALETTES);
  });
});
