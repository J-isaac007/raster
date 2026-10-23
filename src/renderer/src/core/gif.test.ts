import { describe, expect, it } from 'vitest';
import { rgba } from './color';
import { encodeGif } from './gif';
import { decodeGif, GifError } from './gifDecode';
import { quantize } from './quantize';
import { packSheet, sheetMetadata } from './sheet';

const RED = rgba(255, 0, 0);
const BLUE = rgba(0, 0, 255);

describe('GIF round trip', () => {
  it('keeps exact colors, transparency and delays', () => {
    const a = Uint32Array.of(RED, 0, BLUE, RED);
    const b = Uint32Array.of(0, BLUE, BLUE, 0);
    const bytes = encodeGif(2, 2, [
      { pixels: a, delayMs: 120 },
      { pixels: b, delayMs: 50 },
    ]);
    expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe('GIF89a');

    const gif = decodeGif(bytes);
    expect([gif.width, gif.height]).toEqual([2, 2]);
    expect(gif.frames.map((f) => f.delayMs)).toEqual([120, 50]);
    expect([...gif.frames[0].pixels]).toEqual([...a]);
    // Disposal "restore to background" stops frame 1 from showing through.
    expect([...gif.frames[1].pixels]).toEqual([...b]);
  });

  it('scales up with nearest neighbor', () => {
    const gif = decodeGif(
      encodeGif(2, 1, [{ pixels: Uint32Array.of(RED, BLUE), delayMs: 100 }], { scale: 3 }),
    );
    expect([gif.width, gif.height]).toEqual([6, 3]);
    expect([...gif.frames[0].pixels.subarray(0, 6)]).toEqual([RED, RED, RED, BLUE, BLUE, BLUE]);
  });

  it('handles images long enough to reset the LZW table', () => {
    const w = 128;
    const h = 96;
    const pixels = new Uint32Array(w * h);
    // Noise over 64 colors fills the 4096-entry code table several times.
    let seed = 1;
    for (let i = 0; i < pixels.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      pixels[i] = rgba(seed & 0xc0, (seed >> 8) & 0xc0, (seed >> 16) & 0xc0);
    }
    const gif = decodeGif(encodeGif(w, h, [{ pixels, delayMs: 100 }]));
    expect([...gif.frames[0].pixels]).toEqual([...pixels]);
  });

  it('quantizes when there are more than 256 colors', () => {
    const pixels = new Uint32Array(32 * 32).map((_, i) => rgba(i & 255, (i >> 2) & 255, 128));
    const gif = decodeGif(encodeGif(32, 32, [{ pixels, delayMs: 100 }]));
    const unique = new Set(gif.frames[0].pixels);
    expect(unique.size).toBeLessThanOrEqual(256);
    expect(gif.frames[0].pixels.every((c) => c >>> 24 === 255)).toBe(true);
  });

  it('rejects junk', () => {
    expect(() => decodeGif(new Uint8Array([1, 2, 3, 4, 5, 6, 7]))).toThrow(GifError);
    const good = encodeGif(1, 1, [{ pixels: Uint32Array.of(RED), delayMs: 100 }]);
    expect(() => decodeGif(good.subarray(0, good.length - 5))).toThrow(GifError);
  });
});

describe('quantize', () => {
  it('keeps small palettes exactly', () => {
    const { palette } = quantize(
      new Map([
        [RED, 1],
        [BLUE, 1],
      ]),
      4,
    );
    expect(palette).toEqual([RED, BLUE]);
  });

  it('reduces to the requested size', () => {
    const colors = new Map<number, number>();
    for (let i = 0; i < 1000; i++) colors.set(rgba(i % 256, (i * 7) % 256, (i * 13) % 256), 1);
    const { palette, lookup } = quantize(colors, 16);
    expect(palette.length).toBe(16);
    for (const c of colors.keys()) expect(lookup.get(c)).toBeLessThan(16);
  });
});

describe('packSheet', () => {
  it('lays frames out in a grid with padding', () => {
    const frames = [1, 2, 3].map((n) => new Uint32Array(4).fill(n));
    const sheet = packSheet(frames, 2, 2, { columns: 2, padding: 1 });
    expect([sheet.width, sheet.height, sheet.columns, sheet.rows]).toEqual([5, 5, 2, 2]);
    expect(sheet.frames[2]).toEqual({ x: 0, y: 3, w: 2, h: 2 });
    expect(sheet.pixels[0]).toBe(1);
    expect(sheet.pixels[2]).toBe(0); // padding
    expect(sheet.pixels[3]).toBe(2);
    expect(sheet.pixels[3 * 5]).toBe(3);

    const meta = JSON.parse(sheetMetadata(sheet, 'hero.png', [100, 200, 300]));
    expect(meta.frames[1]).toMatchObject({ frame: { x: 3, y: 0, w: 2, h: 2 }, duration: 200 });
    expect(meta.meta.size).toEqual({ w: 5, h: 5 });
    expect(meta.meta.frameTags).toEqual([]);

    const tagged = sheetMetadata(sheet, 'hero.png', [100, 200, 300], undefined, [
      { name: 'walk', from: 1, to: 2 },
    ]);
    expect(JSON.parse(tagged).meta.frameTags).toEqual([
      { name: 'walk', from: 1, to: 2, direction: 'forward' },
    ]);
  });
});
