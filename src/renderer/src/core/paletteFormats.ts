import { blue, green, red, rgba, toHex, type Color } from './color';

/**
 * Palette file formats: reading every format the palette library imports and
 * writing the text formats it exports. Pure functions over bytes and strings.
 */

/** Thrown when a palette file is empty, malformed or in an unsupported format. */
export class PaletteFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaletteFormatError';
  }
}

/** File extensions `parsePaletteFile` understands (lowercase, no dot). */
export const PALETTE_EXTENSIONS = ['hex', 'gpl', 'pal', 'txt', 'act', 'ase'] as const;
export type PaletteExtension = (typeof PALETTE_EXTENSIONS)[number];

/** Text formats `formatPalette` can write. */
export type PaletteExportFormat = 'hex' | 'gpl' | 'pal';

/** Palettes read from files are cut off after this many colors. */
export const MAX_PALETTE_COLORS = 256;

export interface ParsedPalette {
  name?: string;
  colors: Color[];
}

/**
 * Reads a palette file. The format comes from the extension, except that a
 * text file whose header names another format (`GIMP Palette`, `JASC-PAL`,
 * `;paint.net`) or a file starting with `ASEF` is read as that format. Files
 * with an unknown extension are sniffed: ASE, GIMP, JASC and Paint.NET by
 * header, ACT by its 768/772-byte size, anything else as a hex list.
 *
 * `name` is the palette's own name when the file has one (GIMP `Name:`, the
 * first ASE group), else the file name without its extension. At most
 * `MAX_PALETTE_COLORS` colors are kept. Throws `PaletteFormatError` when the
 * file is empty, malformed or holds no colors.
 */
export function parsePaletteFile(fileName: string, bytes: Uint8Array): ParsedPalette {
  if (bytes.length === 0) throw new PaletteFormatError('The palette file is empty.');
  const format = detectFormat(extensionOf(fileName), bytes);
  const parsed = PARSERS[format](bytes);
  if (parsed.colors.length === 0) {
    throw new PaletteFormatError(`No colors found in this ${FORMAT_NAMES[format]} file.`);
  }
  return {
    name: parsed.name || baseName(fileName) || undefined,
    colors: parsed.colors.slice(0, MAX_PALETTE_COLORS),
  };
}

/**
 * Serializes a palette for export. `hex` keeps alpha (`rrggbbaa` for colors
 * that are not opaque); GIMP and JASC palettes are RGB only.
 */
export function formatPalette(colors: Color[], format: PaletteExportFormat, name?: string): string {
  switch (format) {
    case 'hex':
      return colors.map((c) => toHex(c).slice(1) + '\n').join('');
    case 'gpl':
      return formatGpl(colors, name);
    case 'pal':
      return formatJasc(colors);
  }
}

// ---- detection ------------------------------------------------------------------

const FORMAT_NAMES: Record<PaletteExtension, string> = {
  hex: 'hex palette',
  gpl: 'GIMP palette',
  pal: 'JASC palette',
  txt: 'Paint.NET palette',
  act: 'Adobe Color Table',
  ase: 'Adobe Swatch Exchange',
};

function isPaletteExtension(ext: string): ext is PaletteExtension {
  return (PALETTE_EXTENSIONS as readonly string[]).includes(ext);
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const slash = Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\'));
  return dot > slash ? fileName.slice(dot + 1).toLowerCase() : '';
}

function baseName(fileName: string): string {
  const file = fileName.slice(Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\')) + 1);
  const dot = file.lastIndexOf('.');
  return (dot > 0 ? file.slice(0, dot) : file).trim();
}

function startsWithAscii(bytes: Uint8Array, text: string): boolean {
  if (bytes.length < text.length) return false;
  for (let i = 0; i < text.length; i++) if (bytes[i] !== text.charCodeAt(i)) return false;
  return true;
}

/** The format a magic number or text header identifies, if any. */
function sniffHeader(bytes: Uint8Array): PaletteExtension | null {
  if (startsWithAscii(bytes, 'ASEF')) return 'ase';
  if (startsWithAscii(bytes, 'RIFF')) {
    throw new PaletteFormatError('Microsoft RIFF palettes are not supported.');
  }
  const head = decodeText(bytes.subarray(0, 64)).trimStart();
  if (head.startsWith('GIMP Palette')) return 'gpl';
  if (head.startsWith('JASC-PAL')) return 'pal';
  if (/^;\s*paint\.net/i.test(head)) return 'txt';
  return null;
}

function detectFormat(ext: string, bytes: Uint8Array): PaletteExtension {
  // Binary formats have no text header to sniff; trust the extension.
  if (ext === 'act' || ext === 'ase') return ext;
  const sniffed = sniffHeader(bytes);
  if (sniffed) return sniffed;
  if (isPaletteExtension(ext)) return ext;
  if (bytes.length === ACT_SIZE || bytes.length === ACT_SIZE + 4) return 'act';
  return 'hex';
}

const PARSERS: Record<PaletteExtension, (bytes: Uint8Array) => ParsedPalette> = {
  hex: (bytes) => ({ colors: parseHexList(decodeText(bytes)) }),
  gpl: (bytes) => parseGpl(decodeText(bytes)),
  pal: (bytes) => ({ colors: parseJasc(decodeText(bytes)) }),
  txt: (bytes) => ({ colors: parsePaintNet(decodeText(bytes)) }),
  act: (bytes) => ({ colors: parseAct(bytes) }),
  ase: parseAse,
};

// ---- text formats ---------------------------------------------------------------

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

const lines = (text: string) => text.split(/\r\n|\r|\n/).map((l) => l.trim());

/** The byte written as two hex digits at offset `i`. */
const hexByte = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);

/** `.hex` (Lospec): one `rrggbb` or `rrggbbaa` per line, optional `#`. */
function parseHexList(text: string): Color[] {
  const colors: Color[] = [];
  for (const line of lines(text)) {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{8})\b/i.exec(line);
    if (!m) continue;
    const hex = m[1];
    colors.push(
      rgba(
        hexByte(hex, 0),
        hexByte(hex, 2),
        hexByte(hex, 4),
        hex.length === 8 ? hexByte(hex, 6) : 255,
      ),
    );
  }
  return colors;
}

const RGB_LINE = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s|$)/;

const channel = (s: string) => Math.min(255, Number(s));

/** GIMP `.gpl`: a `GIMP Palette` header, optional `Name:`, then `r g b [name]` lines. */
function parseGpl(text: string): ParsedPalette {
  const all = lines(text);
  if (all[0] !== 'GIMP Palette') {
    throw new PaletteFormatError('Not a GIMP palette: missing the "GIMP Palette" header.');
  }
  let name: string | undefined;
  const colors: Color[] = [];
  for (const line of all.slice(1)) {
    if (!line || line.startsWith('#')) continue;
    const nameMatch = /^Name:\s*(.*)$/i.exec(line);
    if (nameMatch) {
      name ??= nameMatch[1].trim() || undefined;
      continue;
    }
    const m = RGB_LINE.exec(line);
    if (m) colors.push(rgba(channel(m[1]), channel(m[2]), channel(m[3])));
  }
  return { name, colors };
}

/** JASC `.pal`: `JASC-PAL`, a version line, the color count, then `r g b` lines. */
function parseJasc(text: string): Color[] {
  const all = lines(text).filter((l) => l !== '');
  if (all[0] !== 'JASC-PAL') {
    throw new PaletteFormatError('Not a JASC palette: missing the "JASC-PAL" header.');
  }
  const count = Number(all[2]);
  if (!/^\d+$/.test(all[2] ?? '') || count === 0) {
    throw new PaletteFormatError('Malformed JASC palette: the color count is missing or invalid.');
  }
  const colors: Color[] = [];
  for (const line of all.slice(3, 3 + count)) {
    const m = RGB_LINE.exec(line);
    if (!m) throw new PaletteFormatError(`Malformed JASC palette line: "${line}".`);
    colors.push(rgba(channel(m[1]), channel(m[2]), channel(m[3])));
  }
  return colors;
}

/** Paint.NET `.txt`: `;` comments, then one `AARRGGBB` per line (alpha first). */
function parsePaintNet(text: string): Color[] {
  const colors: Color[] = [];
  for (const line of lines(text)) {
    if (!line || line.startsWith(';')) continue;
    const m = /^([0-9a-f]{8}|[0-9a-f]{6})\b/i.exec(line);
    if (!m) continue;
    const hex = m[1].length === 6 ? 'ff' + m[1] : m[1];
    colors.push(rgba(hexByte(hex, 2), hexByte(hex, 4), hexByte(hex, 6), hexByte(hex, 0)));
  }
  return colors;
}

function formatGpl(colors: Color[], name?: string): string {
  const title = name?.replace(/[\r\n]+/g, ' ').trim();
  const header = ['GIMP Palette', ...(title ? [`Name: ${title}`] : []), 'Columns: 0', '#'];
  const pad = (n: number) => String(n).padStart(3, ' ');
  const rows = colors.map(
    (c) => `${pad(red(c))} ${pad(green(c))} ${pad(blue(c))}\t${toHex(c, false).slice(1)}`,
  );
  return [...header, ...rows].join('\n') + '\n';
}

function formatJasc(colors: Color[]): string {
  const rows = colors.map((c) => `${red(c)} ${green(c)} ${blue(c)}`);
  return ['JASC-PAL', '0100', String(colors.length), ...rows].join('\r\n') + '\r\n';
}

// ---- Adobe Color Table ----------------------------------------------------------

const ACT_SIZE = 256 * 3;

/**
 * Photoshop `.act`: 256 RGB triples, optionally followed by the number of
 * colors in use and the transparent index (both u16 big-endian, 0xffff = no
 * transparent color). The transparent entry keeps its RGB with alpha 0.
 */
function parseAct(bytes: Uint8Array): Color[] {
  if (bytes.length !== ACT_SIZE && bytes.length !== ACT_SIZE + 4) {
    throw new PaletteFormatError(
      `Not an Adobe Color Table: expected 768 or 772 bytes, got ${bytes.length}.`,
    );
  }
  let count = 256;
  let transparent = -1;
  if (bytes.length === ACT_SIZE + 4) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + ACT_SIZE, 4);
    const declared = view.getUint16(0);
    if (declared > 0 && declared <= 256) count = declared;
    const t = view.getUint16(2);
    if (t !== 0xffff) transparent = t;
  }
  const colors: Color[] = [];
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    colors.push(rgba(bytes[o], bytes[o + 1], bytes[o + 2], i === transparent ? 0 : 255));
  }
  return colors;
}

// ---- Adobe Swatch Exchange ------------------------------------------------------

const ASE_COLOR = 0x0001;
const ASE_GROUP_START = 0xc001;

/** A bounds-checked big-endian cursor over the file. */
class AseReader {
  private readonly view: DataView;
  offset = 0;

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get length(): number {
    return this.view.byteLength;
  }

  need(n: number, end = this.length): void {
    if (this.offset + n > end) {
      throw new PaletteFormatError('Malformed Adobe Swatch Exchange file: it ends too early.');
    }
  }

  u16(end?: number): number {
    this.need(2, end);
    const v = this.view.getUint16(this.offset);
    this.offset += 2;
    return v;
  }

  u32(end?: number): number {
    this.need(4, end);
    const v = this.view.getUint32(this.offset);
    this.offset += 4;
    return v;
  }

  f32(end?: number): number {
    this.need(4, end);
    const v = this.view.getFloat32(this.offset);
    this.offset += 4;
    return v;
  }

  ascii(n: number, end?: number): string {
    this.need(n, end);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.view.getUint8(this.offset + i));
    this.offset += n;
    return s;
  }

  /** A u16 length in UTF-16 code units (counting the null) followed by UTF-16BE text. */
  utf16(end?: number): string {
    const units = this.u16(end);
    this.need(units * 2, end);
    const codes: number[] = [];
    for (let i = 0; i < units; i++) codes.push(this.view.getUint16(this.offset + i * 2));
    this.offset += units * 2;
    while (codes.length > 0 && codes[codes.length - 1] === 0) codes.pop();
    return String.fromCharCode(...codes);
  }
}

/** `.ase`: color blocks, possibly nested in groups, flattened into one list. */
function parseAse(bytes: Uint8Array): ParsedPalette {
  const r = new AseReader(bytes);
  if (r.ascii(4) !== 'ASEF') {
    throw new PaletteFormatError('Not an Adobe Swatch Exchange file: missing the "ASEF" header.');
  }
  r.u16(); // major version
  r.u16(); // minor version
  const blocks = r.u32();
  let name: string | undefined;
  const colors: Color[] = [];
  for (let i = 0; i < blocks && colors.length < MAX_PALETTE_COLORS; i++) {
    const type = r.u16();
    const length = r.u32();
    const end = r.offset + length;
    if (end > r.length) {
      throw new PaletteFormatError(
        'Malformed Adobe Swatch Exchange file: a block runs past the end.',
      );
    }
    if (type === ASE_GROUP_START && length > 0) {
      name ??= r.utf16(end).trim() || undefined;
    } else if (type === ASE_COLOR) {
      r.utf16(end); // swatch name
      colors.push(readAseColor(r, end));
    }
    r.offset = end;
  }
  return { name, colors };
}

function readAseColor(r: AseReader, end: number): Color {
  const model = r.ascii(4, end);
  const values = (n: number) => Array.from({ length: n }, () => r.f32(end));
  switch (model) {
    case 'RGB ': {
      const [cr, cg, cb] = values(3);
      return rgba(unit(cr), unit(cg), unit(cb));
    }
    case 'CMYK': {
      const [c, m, y, k] = values(4);
      return cmykToRgb(c, m, y, k);
    }
    case 'Gray': {
      const v = unit(values(1)[0]);
      return rgba(v, v, v);
    }
    case 'LAB ': {
      // L is stored as a fraction of 100; a and b as-is.
      const [l, a, b] = values(3);
      return labToRgb(l * 100, a, b);
    }
    default:
      throw new PaletteFormatError(
        `Unsupported color model "${model.trim()}" in Adobe Swatch Exchange file.`,
      );
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/** A 0..1 component as a 0..255 channel. */
const unit = (v: number) => Math.round(clamp01(v) * 255);

/** Naive (uncalibrated) CMYK to RGB; components are 0..1. */
export function cmykToRgb(c: number, m: number, y: number, k: number): Color {
  const ch = (v: number) => unit((1 - clamp01(v)) * (1 - clamp01(k)));
  return rgba(ch(c), ch(m), ch(y));
}

/** CIE L*a*b* (D50, as Adobe uses) to sRGB, with Bradford adaptation to D65. */
export function labToRgb(l: number, a: number, b: number): Color {
  const EPSILON = 216 / 24389;
  const KAPPA = 24389 / 27;
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (f: number) => (f ** 3 > EPSILON ? f ** 3 : (116 * f - 16) / KAPPA);
  const x = 0.96422 * inv(fx);
  const y = 1 * (l > KAPPA * EPSILON ? fy ** 3 : l / KAPPA);
  const z = 0.82521 * inv(fz);
  // XYZ (D50) -> linear sRGB (D65), Bradford-adapted.
  const lr = 3.1338561 * x - 1.6168667 * y - 0.4906146 * z;
  const lg = -0.9787684 * x + 1.9161415 * y + 0.033454 * z;
  const lb = 0.0719453 * x - 0.2289914 * y + 1.4052427 * z;
  const gamma = (v: number) => {
    const c = clamp01(v);
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  };
  return rgba(unit(gamma(lr)), unit(gamma(lg)), unit(gamma(lb)));
}
