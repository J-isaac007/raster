import { beforeEach, describe, expect, it } from 'vitest';
import { rgba } from '@core/color';
import { Editor } from '@editor/editor';
import { deletePalette, getSavedPalettes } from '@platform/palettes';
import {
  applyPalette,
  importPaletteFile,
  isPaletteFile,
  saveCurrentPalette,
  savedColors,
} from './palettes';

const RED = rgba(255, 0, 0);
const GREEN = rgba(0, 255, 0);
const BLUE = rgba(0, 0, 255);

const file = (name: string, text: string) => new File([text], name);

describe('palette library actions', () => {
  let editor: Editor;
  beforeEach(async () => {
    editor = new Editor();
    for (const p of getSavedPalettes()) await deletePalette(p.id);
  });

  it('recognizes palette files by extension', () => {
    for (const name of ['a.hex', 'b.GPL', 'c.pal', 'd.txt', 'e.act', 'f.ase']) {
      expect(isPaletteFile(name)).toBe(true);
    }
    expect(isPaletteFile('hero.png')).toBe(false);
    expect(isPaletteFile('hero.raster')).toBe(false);
  });

  it('replaces the palette or adds only the new colors', () => {
    editor.setPalette([RED]);
    applyPalette(editor, 'x', [RED, GREEN, BLUE], 'add');
    expect(editor.getState().palette).toEqual([RED, GREEN, BLUE]);
    applyPalette(editor, 'x', [BLUE], 'replace');
    expect(editor.getState().palette).toEqual([BLUE]);
  });

  it('imports a file into My palettes once, applying it when asked', async () => {
    const gpl = file('ramp.gpl', 'GIMP Palette\nName: Ramp\n#\n255 0 0\n0 255 0\n');
    const entry = await importPaletteFile(editor, gpl, { apply: true });
    expect(entry?.name).toBe('Ramp');
    expect(savedColors(entry!)).toEqual([RED, GREEN]);
    expect(editor.getState().palette).toEqual([RED, GREEN]);

    const again = await importPaletteFile(editor, gpl, { apply: false });
    expect(again?.id).toBe(entry!.id);
    expect(getSavedPalettes()).toHaveLength(1);
  });

  it('reports unreadable files without changing anything', async () => {
    const before = editor.getState().palette;
    expect(await importPaletteFile(editor, file('bad.pal', 'nope'), { apply: true })).toBeNull();
    expect(editor.getState().palette).toBe(before);
    expect(getSavedPalettes()).toHaveLength(0);
  });

  it('saves the current palette with alpha', async () => {
    editor.setPalette([RED, rgba(0, 0, 255, 128)]);
    const entry = await saveCurrentPalette(editor, 'Mine');
    expect(entry?.colors).toEqual(['#ff0000ff', '#0000ff80']);
    expect(getSavedPalettes()[0].name).toBe('Mine');
  });
});
