import { describe, expect, it } from 'vitest';
import { rgba, TRANSPARENT } from './color';
import {
  formatHexPalette,
  nearestColor,
  paletteRemap,
  paletteSnapper,
  parsePalette,
  recolorPixels,
} from './palette';

const BLACK = rgba(0, 0, 0);
const WHITE = rgba(255, 255, 255);
const RED = rgba(255, 0, 0);
const BLUE = rgba(0, 0, 255);

describe('parsePalette', () => {
  it('reads .hex and .gpl files', () => {
    expect(parsePalette('ff0000\n#0000ff\n')).toEqual([RED, BLUE]);
    expect(parsePalette('GIMP Palette\nName: x\n#\n255 0 0 Red\n0 0 255\n')).toEqual([RED, BLUE]);
  });

  it('round-trips through formatHexPalette', () => {
    expect(parsePalette(formatHexPalette([RED, BLUE]))).toEqual([RED, BLUE]);
  });
});

describe('nearestColor', () => {
  it('picks the closest palette entry', () => {
    expect(nearestColor(rgba(200, 30, 20), [BLACK, WHITE, RED])).toBe(RED);
    expect(nearestColor(rgba(90, 90, 90), [BLACK, WHITE, RED])).toBe(BLACK);
    expect(nearestColor(WHITE, [BLACK, WHITE])).toBe(WHITE);
  });

  it('keeps transparent pixels transparent', () => {
    expect(nearestColor(rgba(255, 0, 0, 0), [RED])).toBe(TRANSPARENT);
    expect(nearestColor(RED, [])).toBe(TRANSPARENT);
  });

  it('caches results in paletteSnapper', () => {
    const snap = paletteSnapper([BLACK, WHITE]);
    expect(snap(rgba(250, 250, 250))).toBe(WHITE);
    expect(snap(rgba(250, 250, 250))).toBe(WHITE);
    expect(snap(rgba(5, 5, 5))).toBe(BLACK);
  });
});

describe('paletteRemap', () => {
  it('swaps by index when the palette keeps its size', () => {
    const map = paletteRemap([BLACK, RED], [WHITE, BLUE]);
    expect(map(BLACK)).toBe(WHITE);
    expect(map(RED)).toBe(BLUE);
    expect(map(TRANSPARENT)).toBe(TRANSPARENT);
  });

  it('keeps remaining colors and snaps removed ones when the size changes', () => {
    const map = paletteRemap([BLACK, RED, WHITE], [BLACK, WHITE]);
    expect(map(BLACK)).toBe(BLACK);
    expect(map(WHITE)).toBe(WHITE);
    expect(map(RED)).toBe(BLACK);
  });
});

describe('recolorPixels', () => {
  it('maps pixels in place and returns an undoable patch', () => {
    const px = Uint32Array.from([RED, BLACK, RED]);
    const patch = recolorPixels(px, (c) => (c === RED ? BLUE : c));
    expect([...px]).toEqual([BLUE, BLACK, BLUE]);
    expect([...patch!.indices]).toEqual([0, 2]);
    expect([...patch!.before]).toEqual([RED, RED]);
  });

  it('returns null when nothing changes', () => {
    expect(recolorPixels(Uint32Array.from([RED]), (c) => c)).toBeNull();
  });
});
