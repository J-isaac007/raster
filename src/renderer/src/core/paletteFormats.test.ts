import { describe, expect, it } from 'vitest';
import { rgba } from './color';
import {
  cmykToRgb,
  formatPalette,
  labToRgb,
  MAX_PALETTE_COLORS,
  PaletteFormatError,
  parsePaletteFile,
} from './paletteFormats';

const RED = rgba(255, 0, 0);
const GREEN = rgba(0, 255, 0);
const BLUE = rgba(0, 0, 255);

const text = (s: string) => new TextEncoder().encode(s);

/** An Adobe Color Table: `rgb` triples padded to 256 entries, plus an optional footer. */
function buildAct(rgb: number[][], footer?: { count: number; transparent: number }): Uint8Array {
  const bytes = new Uint8Array(768 + (footer ? 4 : 0));
  rgb.forEach((c, i) => bytes.set(c, i * 3));
  if (footer) {
    const view = new DataView(bytes.buffer, 768);
    view.setUint16(0, footer.count);
    view.setUint16(2, footer.transparent);
  }
  return bytes;
}

type AseBlock =
  | { kind: 'group'; name: string }
  | { kind: 'end' }
  | { kind: 'color'; name: string; model: string; values: number[] };

const nameSize = (name: string) => 2 + (name.length + 1) * 2;

function blockSize(b: AseBlock): number {
  if (b.kind === 'group') return nameSize(b.name);
  if (b.kind === 'end') return 0;
  return nameSize(b.name) + 4 + b.values.length * 4 + 2;
}

/** An Adobe Swatch Exchange file holding `blocks`, built byte by byte. */
function buildAse(blocks: AseBlock[]): Uint8Array {
  const size = 12 + blocks.reduce((n, b) => n + 6 + blockSize(b), 0);
  const view = new DataView(new ArrayBuffer(size));
  let o = 0;
  const ascii = (s: string) => {
    for (const ch of s) view.setUint8(o++, ch.charCodeAt(0));
  };
  const u16 = (v: number) => {
    view.setUint16(o, v);
    o += 2;
  };
  const utf16 = (s: string) => {
    u16(s.length + 1);
    for (const ch of s) u16(ch.charCodeAt(0));
    u16(0);
  };
  ascii('ASEF');
  u16(1);
  u16(0);
  view.setUint32(o, blocks.length);
  o += 4;
  for (const b of blocks) {
    u16(b.kind === 'group' ? 0xc001 : b.kind === 'end' ? 0xc002 : 0x0001);
    view.setUint32(o, blockSize(b));
    o += 4;
    if (b.kind === 'group') utf16(b.name);
    if (b.kind === 'color') {
      utf16(b.name);
      ascii(b.model);
      for (const v of b.values) {
        view.setFloat32(o, v);
        o += 4;
      }
      u16(2); // normal color
    }
  }
  return new Uint8Array(view.buffer);
}

describe('parsePaletteFile', () => {
  it('reads Lospec .hex lists with and without # and alpha', () => {
    const out = parsePaletteFile('pico.hex', text('#ff0000\n00ff0080\nnot a color\n0000FF\n'));
    expect(out).toEqual({ name: 'pico', colors: [RED, rgba(0, 255, 0, 128), BLUE] });
  });

  it('reads GIMP palettes and their name', () => {
    const gpl = 'GIMP Palette\nName: Sunset\nColumns: 4\n#\n255   0   0\tRed\n  0 255   0\n';
    expect(parsePaletteFile('a.gpl', text(gpl))).toEqual({ name: 'Sunset', colors: [RED, GREEN] });
  });

  it('reads JASC palettes and respects the color count', () => {
    const pal = 'JASC-PAL\r\n0100\r\n2\r\n255 0 0\r\n0 255 0\r\n0 0 255\r\n';
    expect(parsePaletteFile('a.pal', text(pal)).colors).toEqual([RED, GREEN]);
  });

  it('reads Paint.NET palettes with alpha first', () => {
    const txt = '; paint.net Palette File\n; Colors: 2\n80FF0000\nFF0000FF\n';
    expect(parsePaletteFile('a.txt', text(txt)).colors).toEqual([rgba(255, 0, 0, 128), BLUE]);
  });

  it('reads 768-byte Adobe Color Tables as 256 colors', () => {
    const colors = parsePaletteFile('a.act', buildAct([[255, 0, 0]])).colors;
    expect(colors).toHaveLength(256);
    expect(colors[0]).toBe(RED);
    expect(colors[1]).toBe(rgba(0, 0, 0));
  });

  it('respects the ACT color count and transparent index', () => {
    const rgb = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [9, 9, 9],
    ];
    expect(parsePaletteFile('a.act', buildAct(rgb, { count: 3, transparent: 1 })).colors).toEqual([
      RED,
      rgba(0, 255, 0, 0),
      BLUE,
    ]);
    expect(
      parsePaletteFile('a.act', buildAct(rgb, { count: 2, transparent: 0xffff })).colors,
    ).toEqual([RED, GREEN]);
  });

  it('reads Adobe Swatch Exchange files, flattening groups', () => {
    const ase = buildAse([
      { kind: 'group', name: 'Brand' },
      { kind: 'color', name: 'Red', model: 'RGB ', values: [1, 0, 0] },
      { kind: 'color', name: 'Ink', model: 'CMYK', values: [0, 1, 1, 0] },
      { kind: 'end' },
      { kind: 'group', name: 'Other' },
      { kind: 'color', name: 'Mid', model: 'Gray', values: [0.5] },
      { kind: 'color', name: 'White', model: 'LAB ', values: [1, 0, 0] },
      { kind: 'end' },
    ]);
    expect(parsePaletteFile('swatches.ase', ase)).toEqual({
      name: 'Brand',
      colors: [RED, RED, rgba(128, 128, 128), rgba(255, 255, 255)],
    });
  });

  it('names ungrouped ASE palettes after the file', () => {
    const ase = buildAse([{ kind: 'color', name: 'Blue', model: 'RGB ', values: [0, 0, 1] }]);
    expect(parsePaletteFile('C:\\palettes\\Ocean.ase', ase)).toEqual({
      name: 'Ocean',
      colors: [BLUE],
    });
  });

  it('sniffs the format when the extension is unknown or misleading', () => {
    expect(parsePaletteFile('a.dat', text('GIMP Palette\n255 0 0\n')).colors).toEqual([RED]);
    expect(parsePaletteFile('a.txt', text('JASC-PAL\n0100\n1\n0 0 255\n')).colors).toEqual([BLUE]);
    expect(parsePaletteFile('a.hex', text(';paint.net\nFF00FF00\n')).colors).toEqual([GREEN]);
    const ase = buildAse([{ kind: 'color', name: 'R', model: 'RGB ', values: [1, 0, 0] }]);
    expect(parsePaletteFile('a.hex', ase).colors).toEqual([RED]);
    expect(
      parsePaletteFile('noext', buildAct([[255, 0, 0]], { count: 1, transparent: 0xffff })),
    ).toEqual({ name: 'noext', colors: [RED] });
    expect(parsePaletteFile('a.colors', text('ff0000\n')).colors).toEqual([RED]);
  });

  it(`keeps at most ${MAX_PALETTE_COLORS} colors`, () => {
    const hex = Array.from({ length: 300 }, (_, i) => (i % 256).toString(16).padStart(6, '0'));
    const colors = parsePaletteFile('big.hex', text(hex.join('\n'))).colors;
    expect(colors).toHaveLength(MAX_PALETTE_COLORS);
    expect(colors[255]).toBe(rgba(0, 0, 255));
  });

  it('throws PaletteFormatError for empty or malformed files', () => {
    const bad: [string, Uint8Array][] = [
      ['empty.hex', new Uint8Array()],
      ['junk.hex', text('hello world\n')],
      ['a.gpl', text('255 0 0\n')],
      ['a.pal', text('JASC-PAL\n0100\nlots\n255 0 0\n')],
      ['a.pal', text('JASC-PAL\n0100\n2\n255 0 0\nbroken\n')],
      ['a.txt', text('; only comments\n')],
      ['a.act', new Uint8Array(100)],
      ['a.ase', text('ASEX\0\x01\0\0\0\0\0\0')],
      [
        'a.ase',
        buildAse([{ kind: 'color', name: 'R', model: 'RGB ', values: [1, 0, 0] }]).slice(0, 30),
      ],
      ['a.ase', buildAse([{ kind: 'color', name: 'R', model: 'XYZ ', values: [1, 0, 0] }])],
      ['a.ase', buildAse([])],
      ['a.pal', text('RIFF\0\0\0\0PAL data')],
    ];
    for (const [name, bytes] of bad) {
      expect(() => parsePaletteFile(name, bytes), name).toThrow(PaletteFormatError);
    }
  });
});

describe('color conversions', () => {
  it('converts CMYK naively', () => {
    expect(cmykToRgb(0, 0, 0, 0)).toBe(rgba(255, 255, 255));
    expect(cmykToRgb(0, 0, 0, 1)).toBe(rgba(0, 0, 0));
    expect(cmykToRgb(1, 0, 1, 0.5)).toBe(rgba(0, 128, 0));
  });

  it('converts D50 Lab to sRGB', () => {
    expect(labToRgb(100, 0, 0)).toBe(rgba(255, 255, 255));
    expect(labToRgb(0, 0, 0)).toBe(rgba(0, 0, 0));
    // sRGB red is roughly L*54.3 a*80.8 b*69.9 under D50.
    expect(labToRgb(54.29, 80.8, 69.89)).toBe(RED);
  });
});

describe('formatPalette', () => {
  const colors = [RED, GREEN, BLUE, rgba(18, 52, 86)];

  it('round-trips .hex, keeping alpha', () => {
    const withAlpha = [...colors, rgba(1, 2, 3, 64)];
    const out = formatPalette(withAlpha, 'hex');
    expect(out).toBe('ff0000\n00ff00\n0000ff\n123456\n01020340\n');
    expect(parsePaletteFile('x.hex', text(out)).colors).toEqual(withAlpha);
  });

  it('round-trips .gpl with its name', () => {
    const out = formatPalette(colors, 'gpl', 'My\npalette');
    expect(out.split('\n').slice(0, 2)).toEqual(['GIMP Palette', 'Name: My palette']);
    expect(parsePaletteFile('x.gpl', text(out))).toEqual({ name: 'My palette', colors });
  });

  it('round-trips JASC .pal', () => {
    const out = formatPalette(colors, 'pal');
    expect(out.startsWith('JASC-PAL\r\n0100\r\n4\r\n255 0 0\r\n')).toBe(true);
    expect(parsePaletteFile('x.pal', text(out)).colors).toEqual(colors);
  });
});
