import { describe, expect, it } from 'vitest';
import { alpha, blend, blue, fromHex, green, red, rgba, toHex, TRANSPARENT } from './color';

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
