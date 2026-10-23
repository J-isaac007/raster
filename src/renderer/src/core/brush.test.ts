import { describe, expect, it } from 'vitest';
import {
  adjustLightness,
  brushOrigin,
  brushPixelColor,
  DITHER_LEVELS,
  ditherHit,
  makeCustomBrush,
  PixelPerfect,
  shadeColor,
} from './brush';
import { rgba } from './color';
import { plotLine } from './raster';

describe('ditherHit', () => {
  const coverage = (level: number) => {
    let n = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ditherHit(x, y, level)) n++;
    return n;
  };

  it('covers level/16 of each 4×4 tile', () => {
    expect(coverage(0)).toBe(0);
    expect(coverage(8)).toBe(8);
    expect(coverage(DITHER_LEVELS)).toBe(16);
  });

  it('makes a checkerboard at 50%', () => {
    expect([0, 1, 2, 3].map((x) => ditherHit(x, 0, 8))).toEqual([true, false, true, false]);
    expect([0, 1, 2, 3].map((x) => ditherHit(x, 1, 8))).toEqual([false, true, false, true]);
  });
});

describe('PixelPerfect', () => {
  it('drops L corners from a staircase', () => {
    const pp = new PixelPerfect();
    // A hand-drawn diagonal often arrives as right, down, right, down...
    const path = [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ];
    const removed = path.map(([x, y]) => pp.push({ x, y })).filter(Boolean);
    expect(removed).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 1 },
    ]);
  });

  it('keeps straight lines and real diagonals intact', () => {
    const pp = new PixelPerfect();
    const removed: unknown[] = [];
    plotLine(0, 0, 6, 3, (x, y) => {
      const r = pp.push({ x, y });
      if (r) removed.push(r);
    });
    expect(removed).toEqual([]);
  });

  it('ignores repeated points', () => {
    const pp = new PixelPerfect();
    expect(pp.push({ x: 0, y: 0 })).toBeNull();
    expect(pp.push({ x: 0, y: 0 })).toBeNull();
  });
});

describe('shading', () => {
  const ramp = [rgba(20, 20, 40), rgba(60, 60, 100), rgba(120, 120, 180)];

  it('steps along the palette', () => {
    expect(shadeColor(ramp[1], ramp, 1)).toBe(ramp[2]);
    expect(shadeColor(ramp[1], ramp, -1)).toBe(ramp[0]);
    expect(shadeColor(ramp[2], ramp, 1)).toBe(ramp[2]);
  });

  it('falls back to lightness for colors outside the palette', () => {
    const c = rgba(100, 50, 50);
    const lighter = shadeColor(c, ramp, 1);
    expect(lighter).not.toBe(c);
    expect(lighter & 255).toBeGreaterThan(100);
  });

  it('leaves transparent pixels alone', () => {
    expect(shadeColor(0, ramp, 1)).toBe(0);
  });

  it('round-trips through HSL', () => {
    const c = rgba(12, 200, 99, 77);
    expect(adjustLightness(c, 0)).toBe(c);
  });
});

describe('custom brushes', () => {
  const A = rgba(255, 0, 0);
  const B = rgba(0, 0, 255, 128);

  it('trims transparent borders', () => {
    const brush = makeCustomBrush({
      width: 4,
      height: 3,
      pixels: Uint32Array.of(0, 0, 0, 0, 0, A, B, 0, 0, 0, A, 0),
    });
    expect(brush).toMatchObject({ width: 2, height: 2 });
    expect([...brush!.pixels]).toEqual([A, B, 0, A]);
  });

  it('returns null for an empty selection', () => {
    expect(makeCustomBrush({ width: 2, height: 1, pixels: new Uint32Array(2) })).toBeNull();
  });

  it('centers like square brushes', () => {
    expect(brushOrigin({ width: 3, height: 3 })).toEqual([1, 1]);
    expect(brushOrigin({ width: 2, height: 4 })).toEqual([0, 1]);
  });

  it('paints its own colors or the current color masked by its alpha', () => {
    const green = rgba(0, 255, 0);
    expect(brushPixelColor('image', B, green)).toBe(B);
    expect(brushPixelColor('color', B, green)).toBe(rgba(0, 255, 0, 128));
    expect(brushPixelColor('color', A, green)).toBe(green);
  });
});
