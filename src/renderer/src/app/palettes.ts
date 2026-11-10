import { fromHex, toHex, type Color } from '@core/color';
import { mergePalettes } from '@core/palette';
import {
  formatPalette,
  PALETTE_EXTENSIONS,
  PaletteFormatError,
  parsePaletteFile,
} from '@core/paletteFormats';
import type { Editor } from '@editor/editor';
import { saveFileAs } from '@platform/files';
import {
  getSavedPalettes,
  newSavedPalette,
  savePalette,
  type SavedPalette,
} from '@platform/palettes';

/**
 * The palette library in use: importing palette files into "My palettes",
 * saving and exporting the sprite's palette, and applying a palette.
 */

/** `<input accept>` for every palette format Raster reads. */
export const PALETTE_ACCEPT = PALETTE_EXTENSIONS.map((e) => `.${e}`).join(',');

/** True for file names Raster reads as palettes (dropped or opened). */
export function isPaletteFile(name: string): boolean {
  const ext = /\.([^.\\/]+)$/.exec(name)?.[1].toLowerCase() ?? '';
  return (PALETTE_EXTENSIONS as readonly string[]).includes(ext);
}

/** A saved palette's colors; entries that aren't valid colors are skipped. */
export const savedColors = (palette: SavedPalette): Color[] =>
  palette.colors.map(fromHex).filter((c): c is Color => c !== null);

/**
 * Sets the sprite's palette (`replace`), or appends the colors it doesn't
 * have yet (`add`). In indexed color the pixels follow (see EditorPalette).
 */
export function applyPalette(
  editor: Editor,
  name: string,
  colors: readonly Color[],
  mode: 'replace' | 'add',
): void {
  const current = editor.getState().palette;
  if (mode === 'replace') {
    editor.setPalette([...colors]);
    editor.notify(`Palette: ${name}`);
    return;
  }
  const next = mergePalettes(current, colors);
  const added = next.length - current.length;
  if (added === 0) {
    editor.notify(`The palette already has every color in ${name}`);
    return;
  }
  editor.setPalette(next);
  editor.notify(`Added ${added} ${added === 1 ? 'color' : 'colors'} from ${name}`);
}

const sameColors = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());

/** Normalizes to `#rrggbbaa`, the form the library stores. */
const stored = (colors: readonly Color[]) => colors.map((c) => toHex(c, true));

/**
 * Reads a palette file and adds it to My palettes (unless the same palette
 * is already there). With `apply`, it also becomes the sprite's palette.
 * Resolves to the library entry, or null if the file couldn't be read.
 */
export async function importPaletteFile(
  editor: Editor,
  file: File,
  { apply }: { apply: boolean },
): Promise<SavedPalette | null> {
  let name: string;
  let colors: Color[];
  try {
    const parsed = parsePaletteFile(file.name, new Uint8Array(await file.arrayBuffer()));
    name = parsed.name ?? 'Imported palette';
    colors = parsed.colors;
  } catch (e) {
    editor.notify(e instanceof PaletteFormatError ? e.message : `Can't read ${file.name}`);
    return null;
  }

  if (apply) editor.setPalette([...colors]);
  const count = `${colors.length} ${colors.length === 1 ? 'color' : 'colors'}`;
  const existing = getSavedPalettes().find(
    (p) => p.name === name && sameColors(p.colors, stored(colors)),
  );
  if (existing) {
    editor.notify(`${name} (${count}) is already in My palettes`);
    return existing;
  }
  const entry = newSavedPalette(name, stored(colors));
  if (!(await savePalette(entry))) {
    editor.notify(`Loaded ${name}, but My palettes is full`);
    return null;
  }
  editor.notify(`Imported ${name} (${count})`);
  return entry;
}

/** Adds the sprite's palette to My palettes. Resolves to the entry, or null. */
export async function saveCurrentPalette(
  editor: Editor,
  name: string,
): Promise<SavedPalette | null> {
  const { palette } = editor.getState();
  if (palette.length === 0) {
    editor.notify('The palette is empty');
    return null;
  }
  const entry = newSavedPalette(name, stored(palette));
  if (!(await savePalette(entry))) {
    editor.notify('My palettes is full; delete a palette first');
    return null;
  }
  editor.notify(`Saved ${entry.name} to My palettes`);
  return entry;
}

/** Renames a palette in My palettes. */
export async function renameSavedPalette(palette: SavedPalette, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || trimmed === palette.name) return;
  await savePalette({ ...palette, name: trimmed });
}

/** Saves the sprite's palette as `.hex`, `.gpl` or `.pal`, whichever the user picks. */
export function exportPalette(editor: Editor): void {
  const { palette, fileName } = editor.getState();
  if (palette.length === 0) {
    editor.notify('The palette is empty');
    return;
  }
  saveFileAs(fileName, [
    { extension: 'hex', label: 'Hex palette (Lospec)', text: formatPalette(palette, 'hex') },
    { extension: 'gpl', label: 'GIMP palette', text: formatPalette(palette, 'gpl', fileName) },
    { extension: 'pal', label: 'JASC palette', text: formatPalette(palette, 'pal') },
  ]);
}
