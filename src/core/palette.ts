import { fromHex, rgba, toHex, type Color } from './color';

export interface PalettePreset {
  name: string;
  colors: Color[];
}

const hexList = (list: string) => list.split(/\s+/).map((h) => fromHex(h)!);

export const PRESETS: PalettePreset[] = [
  {
    name: 'PICO-8',
    colors: hexList(
      '000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa',
    ),
  },
  {
    name: 'Game Boy',
    colors: hexList('0f380f 306230 8bac0f 9bbc0f'),
  },
  {
    name: 'Grayscale',
    colors: Array.from({ length: 8 }, (_, i) => {
      const v = Math.round((i / 7) * 255);
      return rgba(v, v, v);
    }),
  },
];

export const DEFAULT_PALETTE: Color[] = PRESETS[0].colors;

/**
 * Parses a palette file. Supports plain hex lists (`.hex`, as used by Lospec)
 * and GIMP palettes (`.gpl`). Unknown lines are skipped.
 */
export function parsePalette(text: string): Color[] {
  const colors: Color[] = [];
  const isGpl = text.trimStart().startsWith('GIMP Palette');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) {
      // `#` starts a comment in .gpl but may also start a hex color.
      if (!isGpl && /^#[0-9a-f]{3,8}$/i.test(line)) colors.push(fromHex(line)!);
      continue;
    }
    if (isGpl) {
      const m = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\b/.exec(line);
      if (m) colors.push(rgba(+m[1], +m[2], +m[3]));
    } else {
      const c = fromHex(line.split(/\s+/)[0]);
      if (c !== null) colors.push(c);
    }
  }
  return colors;
}

/** Serializes to the `.hex` format: one `rrggbb` (or `rrggbbaa`) per line. */
export function formatHexPalette(colors: Color[]): string {
  return colors.map((c) => toHex(c).slice(1)).join('\n') + '\n';
}
