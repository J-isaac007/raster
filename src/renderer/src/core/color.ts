/**
 * A color packed into a 32-bit unsigned integer.
 *
 * Byte order matches `ImageData` on little-endian machines (every platform
 * Raster targets): the lowest byte is red, the highest is alpha. This lets a
 * `Uint32Array` view over an `ImageData` buffer be read and written directly.
 */
export type Color = number;

export const TRANSPARENT: Color = 0;

export function rgba(r: number, g: number, b: number, a = 255): Color {
  return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
}

export const red = (c: Color): number => c & 255;
export const green = (c: Color): number => (c >>> 8) & 255;
export const blue = (c: Color): number => (c >>> 16) & 255;
export const alpha = (c: Color): number => c >>> 24;

export function withAlpha(c: Color, a: number): Color {
  return rgba(red(c), green(c), blue(c), a);
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/** Formats as `#rrggbb`, or `#rrggbbaa` when the color is not fully opaque. */
export function toHex(c: Color, includeAlpha = alpha(c) !== 255): string {
  const rgb = `#${hex2(red(c))}${hex2(green(c))}${hex2(blue(c))}`;
  return includeAlpha ? rgb + hex2(alpha(c)) : rgb;
}

/** Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (the `#` is optional). */
export function fromHex(input: string): Color | null {
  let hex = input.trim().replace(/^#/, '');
  if (!/^[0-9a-f]+$/i.test(hex)) return null;
  if (hex.length === 3 || hex.length === 4) {
    hex = [...hex].map((ch) => ch + ch).join('');
  }
  if (hex.length !== 6 && hex.length !== 8) return null;
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return rgba(n(0), n(2), n(4), hex.length === 8 ? n(6) : 255);
}

// ---- HSL and HSV ------------------------------------------------------------
// Hue, saturation, lightness and value all run 0..1. A hue outside 0..1 wraps
// around (1.25 is 0.25); grays have hue 0 and saturation 0. Alpha is passed
// through untouched.

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const wrapHue = (h: number) => h - Math.floor(h);

/** Red, green and blue as 0..1, and the max and min of the three. */
function channels(c: Color) {
  const r = red(c) / 255;
  const g = green(c) / 255;
  const b = blue(c) / 255;
  return { r, g, b, max: Math.max(r, g, b), min: Math.min(r, g, b) };
}

/** The shared hue formula of HSL and HSV. */
function hueOf(r: number, g: number, b: number, max: number, d: number): number {
  if (d === 0) return 0;
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h / 6;
}

/** `[hue, saturation, lightness]`, each 0..1. */
export function toHsl(c: Color): [number, number, number] {
  const { r, g, b, max, min } = channels(c);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  return [hueOf(r, g, b, max, d), s, l];
}

export function fromHsl(h: number, s: number, l: number, a = 255): Color {
  s = clamp01(s);
  l = clamp01(l);
  if (s === 0) {
    const v = Math.round(l * 255);
    return rgba(v, v, v, a);
  }
  h = wrapHue(h);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return rgba(
    Math.round(hue(h + 1 / 3) * 255),
    Math.round(hue(h) * 255),
    Math.round(hue(h - 1 / 3) * 255),
    a,
  );
}

/** `[hue, saturation, value]`, each 0..1. */
export function toHsv(c: Color): [number, number, number] {
  const { r, g, b, max, min } = channels(c);
  const d = max - min;
  return [hueOf(r, g, b, max, d), max === 0 ? 0 : d / max, max];
}

export function fromHsv(h: number, s: number, v: number, a = 255): Color {
  s = clamp01(s);
  v = clamp01(v);
  const k = (n: number) => (n + wrapHue(h) * 6) % 6;
  const f = (n: number) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return rgba(Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255), a);
}

/** Composites `src` over `dst` (straight alpha), scaling `src` by `opacity`. */
export function blend(dst: Color, src: Color, opacity = 1): Color {
  const sa = (alpha(src) / 255) * opacity;
  if (sa <= 0) return dst;
  if (sa >= 1) return src;
  const da = alpha(dst) / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return TRANSPARENT;
  const mix = (s: number, d: number) => Math.round((s * sa + d * da * (1 - sa)) / oa);
  return rgba(
    mix(red(src), red(dst)),
    mix(green(src), green(dst)),
    mix(blue(src), blue(dst)),
    Math.round(oa * 255),
  );
}
