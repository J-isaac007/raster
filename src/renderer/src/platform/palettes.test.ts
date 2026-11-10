import { describe, expect, it, vi } from 'vitest';
import { MAX_SAVED_PALETTES } from '@shared/settings';
import {
  deletePalette,
  getSavedPalettes,
  newSavedPalette,
  savePalette,
  subscribeSavedPalettes,
} from './palettes';

describe('saved palettes (in memory, no desktop)', () => {
  it('saves, replaces, notifies and deletes', async () => {
    const changed = vi.fn();
    const unsubscribe = subscribeSavedPalettes(changed);

    const p = newSavedPalette('Mine', ['#FF0000', '#00ff0080']);
    expect(await savePalette(p)).toBe(true);
    expect(getSavedPalettes()).toEqual([{ ...p, colors: ['#ff0000ff', '#00ff0080'] }]);

    expect(await savePalette({ ...p, name: 'Renamed' })).toBe(true);
    expect(getSavedPalettes().map((s) => s.name)).toEqual(['Renamed']);

    await deletePalette(p.id);
    expect(getSavedPalettes()).toEqual([]);
    expect(changed).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it('refuses invalid palettes and a full library', async () => {
    expect(await savePalette(newSavedPalette('Empty', ['nope']))).toBe(false);

    const ids: string[] = [];
    for (let i = 0; i < MAX_SAVED_PALETTES; i++) {
      const p = newSavedPalette(`p${i}`, ['#000000']);
      ids.push(p.id);
      expect(await savePalette(p)).toBe(true);
    }
    expect(await savePalette(newSavedPalette('One too many', ['#000000']))).toBe(false);
    expect(getSavedPalettes()).toHaveLength(MAX_SAVED_PALETTES);

    for (const id of ids) await deletePalette(id);
    expect(getSavedPalettes()).toEqual([]);
  });
});
