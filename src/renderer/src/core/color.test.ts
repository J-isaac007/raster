import { describe, expect, it } from 'vitest';
import {
  alpha,
  blend,
  blue,
  fromHex,
  fromHsl,
  fromHsv,
  green,
  red,
  rgba,
  toHex,
  toHsl,
  toHsv,
  TRANSPARENT,
} from './color';

describe('color', () => {
  it('packs channels in ImageData byte order', () => {
    const c = rgba(1, 2, 3, 4);
    const bytes = new Uint8Array(new Uint32Array([c]).buffer);
    expect([...bytes]).toEqual([1, 2, 3, 4]);
    expect([red(c), green(c), blue(c), alpha(c)]).toEqual([1, 2, 3, 4]);
  });

  it('round-trips hex strings', () => {
    expect(toHex(rgba(255, 0, 77))).toBe('#ff004d');
    expect(toHex(rgba(255, 0, 77, 128))).toBe('#ff004d80');
    expect(fromHex('#ff004d')).toBe(rgba(255, 0, 77));
    expect(fromHex('ff004d80')).toBe(rgba(255, 0, 77, 128));
    expect(fromHex('#f0a')).toBe(rgba(255, 0, 170));
    expect(fromHex('#f0a8')).toBe(rgba(255, 0, 170, 136));
  });

  it('rejects malformed hex', () => {
    expect(fromHex('')).toBeNull();
    expect(fromHex('#12345')).toBeNull();
    expect(fromHex('zzzzzz')).toBeNull();
  });

  it('blends with source-over', () => {
    const white = rgba(255, 255, 255);
    const black = rgba(0, 0, 0);
    expect(blend(white, black)).toBe(black);
    expect(blend(white, TRANSPARENT)).toBe(white);
    expect(blend(TRANSPARENT, rgba(10, 20, 30, 128))).toBe(rgba(10, 20, 30, 128));
    expect(blend(white, black, 0.5)).toBe(rgba(128, 128, 128));
    expect(blend(white, rgba(0, 0, 0, 0), 1)).toBe(white);
  });
});

describe('HSL and HSV', () => {
  const near = (a: number[], b: number[]) => a.forEach((n, i) => expect(n).toBeCloseTo(b[i], 4));
  // Every 17th level of each channel, a few alphas: 4913 colors.
  const samples = function* () {
    for (let r = 0; r < 256; r += 17)
      for (let g = 0; g < 256; g += 17)
        for (let b = 0; b < 256; b += 17) yield rgba(r, g, b, (r + g + b) % 256);
  };

  it('reads primaries, secondaries and grays', () => {
    near(toHsl(rgba(255, 0, 0)), [0, 1, 0.5]);
    near(toHsl(rgba(0, 255, 0)), [1 / 3, 1, 0.5]);
    near(toHsl(rgba(0, 0, 255)), [2 / 3, 1, 0.5]);
    near(toHsv(rgba(255, 255, 0)), [1 / 6, 1, 1]);
    near(toHsv(rgba(255, 0, 255)), [5 / 6, 1, 1]);
    near(toHsv(rgba(0, 128, 128)), [0.5, 1, 128 / 255]);
    // Grays: hue and saturation 0.
    near(toHsl(rgba(128, 128, 128)), [0, 0, 128 / 255]);
    near(toHsv(rgba(0, 0, 0)), [0, 0, 0]);
    near(toHsv(rgba(255, 255, 255)), [0, 0, 1]);
  });

  it('builds colors from HSL and HSV', () => {
    expect(fromHsl(0, 1, 0.5)).toBe(rgba(255, 0, 0));
    expect(fromHsl(2 / 3, 1, 0.25)).toBe(rgba(0, 0, 128));
    expect(fromHsl(0.3, 0, 1)).toBe(rgba(255, 255, 255));
    expect(fromHsv(1 / 3, 1, 1)).toBe(rgba(0, 255, 0));
    expect(fromHsv(0.5, 0.5, 1)).toBe(rgba(128, 255, 255));
    expect(fromHsv(0.9, 0, 0.2)).toBe(rgba(51, 51, 51));
  });

  it('round-trips every sampled color exactly, alpha included', () => {
    for (const c of samples()) {
      const a = alpha(c);
      expect(fromHsl(...toHsl(c), a)).toBe(c);
      expect(fromHsv(...toHsv(c), a)).toBe(c);
    }
  });

  it('wraps hue and clamps saturation, lightness and value', () => {
    expect(fromHsv(1.25, 1, 1)).toBe(fromHsv(0.25, 1, 1));
    expect(fromHsv(-0.5, 1, 1)).toBe(fromHsv(0.5, 1, 1));
    expect(fromHsl(1, 1, 0.5)).toBe(rgba(255, 0, 0));
    expect(fromHsl(0, 2, 0.5)).toBe(fromHsl(0, 1, 0.5));
    expect(fromHsv(0, 1, 5)).toBe(rgba(255, 0, 0));
    expect(fromHsl(0, 1, -1)).toBe(rgba(0, 0, 0));
  });

  it('keeps alpha and defaults it to opaque', () => {
    expect(alpha(fromHsl(0.4, 0.5, 0.5, 77))).toBe(77);
    expect(alpha(fromHsv(0.4, 0.5, 0.5))).toBe(255);
  });
});
