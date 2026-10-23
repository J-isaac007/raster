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
