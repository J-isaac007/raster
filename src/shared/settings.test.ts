import { describe, expect, it } from 'vitest';
import {
  addRecent,
  DEFAULT_SETTINGS,
  MAX_RECENT,
  sanitizeRecent,
  sanitizeSettings,
  type RecentFile,
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
    expect(s.showPixelGrid).toBe(true);
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
