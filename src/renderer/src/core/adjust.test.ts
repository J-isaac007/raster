import { describe, expect, it } from 'vitest';
import {
  applyAdjustment,
  desaturate,
  dropShadow,
  hueSaturation,
  invert,
  outline,
  replaceColor,
} from './adjust';
import { alpha, rgba, toHsl } from './color';
import type { Surface } from './sprite';

const R = rgba(255, 0, 0);
const G = rgba(0, 255, 0);
const B = rgba(0, 0, 255);
const K = rgba(0, 0, 0);
const _ = 0;

function surface(width: number, pixels: number[]): Surface {
  return { width, height: pixels.length / width, pixels: Uint32Array.from(pixels) };
}

/** Draws pixels as a grid: `#` for `color`, `.` for transparent, `o` for anything else. */
function show(width: number, pixels: Uint32Array, color: number): string {
  const rows: string[] = [];
  for (let i = 0; i < pixels.length; i += width) {
    rows.push(
      [...pixels.subarray(i, i + width)]
        .map((c) => (c === color ? '#' : c === 0 ? '.' : 'o'))
        .join(''),
    );
  }
  return rows.join('\n');
}

describe('hueSaturation', () => {
  it('turns the hue around the wheel', () => {
    const s = surface(3, [R, G, _]);
    expect([...hueSaturation(s, 120, 0, 0)]).toEqual([G, B, _]);
    expect([...hueSaturation(s, -120, 0, 0)]).toEqual([B, R, _]);
  });

  it('drains color at -100 saturation and keeps grays gray at +100', () => {
    const gray = rgba(100, 100, 100);
    const out = hueSaturation(surface(2, [rgba(200, 100, 100), gray]), 0, -100, 0);
    expect(toHsl(out[0])[1]).toBe(0);
    expect(hueSaturation(surface(1, [gray]), 0, 100, 0)[0]).toBe(gray);
    expect(toHsl(hueSaturation(surface(1, [rgba(200, 100, 100)]), 0, 100, 0)[0])[1]).toBeCloseTo(1);
  });

  it('runs lightness from black to white and keeps alpha', () => {
    const c = rgba(200, 100, 50, 128);
    expect(hueSaturation(surface(1, [c]), 0, 0, -100)[0]).toBe(rgba(0, 0, 0, 128));
    expect(hueSaturation(surface(1, [c]), 0, 0, 100)[0]).toBe(rgba(255, 255, 255, 128));
  });

  it('returns a copy and leaves the input alone', () => {
    const s = surface(1, [R]);
    const out = hueSaturation(s, 0, 0, 0);
    expect(out).not.toBe(s.pixels);
    hueSaturation(s, 90, 0, 0);
    expect(s.pixels[0]).toBe(R);
  });
});

describe('invert', () => {
  it('flips the color channels, keeps alpha and skips transparent pixels', () => {
    const out = invert(surface(3, [rgba(10, 20, 30, 40), K, _]));
    expect([...out]).toEqual([rgba(245, 235, 225, 40), rgba(255, 255, 255), _]);
  });

  it('leaves transparent pixels with color bits as they are', () => {
    const ghost = rgba(9, 9, 9, 0);
    expect(invert(surface(1, [ghost]))[0]).toBe(ghost);
  });
});

describe('desaturate', () => {
  it('uses luminance, so green is lighter than blue', () => {
    const [g, b] = desaturate(surface(2, [G, B]));
    expect(g).toBe(rgba(182, 182, 182));
    expect(b).toBe(rgba(18, 18, 18));
  });

  it('keeps alpha', () => {
    expect(alpha(desaturate(surface(1, [rgba(255, 0, 0, 77)]))[0])).toBe(77);
  });
});

describe('replaceColor', () => {
  it('replaces only the exact color at tolerance 0', () => {
    const near = rgba(250, 0, 0);
    expect([...replaceColor(surface(3, [R, near, _]), R, B, 0)]).toEqual([B, near, _]);
  });

  it('takes colors within the tolerance on every channel', () => {
    const near = rgba(250, 5, 0);
    const far = rgba(240, 0, 0);
    expect([...replaceColor(surface(3, [R, near, far]), R, B, 5)]).toEqual([B, B, far]);
  });

  it('never fills transparent pixels', () => {
    expect(replaceColor(surface(1, [_]), _, B, 255)[0]).toBe(_);
  });
});

describe('outline', () => {
  const dot = surface(5, [
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    R,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
  ]);

  it('rings the art from outside, with or without corners', () => {
    expect(show(5, outline(dot, K, { place: 'outside', diagonals: false }), K)).toBe(
      ['.....', '..#..', '.#o#.', '..#..', '.....'].join('\n'),
    );
    expect(show(5, outline(dot, K, { place: 'outside', diagonals: true }), K)).toBe(
      ['.....', '.###.', '.#o#.', '.###.', '.....'].join('\n'),
    );
  });

  it('recolors the edge from inside', () => {
    const block = surface(4, [_, _, _, _, _, R, R, R, _, R, R, R, _, R, R, R]);
    // The surface's own edges count as transparent.
    expect(show(4, outline(block, K, { place: 'inside', diagonals: false }), K)).toBe(
      ['....', '.###', '.#o#', '.###'].join('\n'),
    );
  });

  it('only fills inner corners with diagonals', () => {
    const l = surface(3, [R, _, _, R, R, _, _, _, _]);
    expect(show(3, outline(l, K, { place: 'outside', diagonals: false }), K)).toBe(
      ['o#.', 'oo#', '##.'].join('\n'),
    );
    expect(show(3, outline(l, K, { place: 'outside', diagonals: true }), K)).toBe(
      ['o##', 'oo#', '###'].join('\n'),
    );
  });
});

describe('dropShadow', () => {
  it('casts the shadow onto transparent pixels only', () => {
    const s = surface(4, [R, R, _, _, R, R, _, _, _, _, _, _, _, _, _, _]);
    expect(show(4, dropShadow(s, K, 1, 1), K)).toBe(['oo..', 'oo#.', '.##.', '....'].join('\n'));
  });

  it('casts up and left with negative offsets and clips at the edges', () => {
    const s = surface(3, [_, _, _, _, R, _, _, _, R]);
    expect(show(3, dropShadow(s, K, -1, -1), K)).toBe(['#..', '.o.', '..o'].join('\n'));
  });
});

describe('applyAdjustment', () => {
  it('dispatches by kind', () => {
    const s = surface(2, [R, _]);
    expect([...applyAdjustment(s, { kind: 'invert' })]).toEqual([...invert(s)]);
    expect([...applyAdjustment(s, { kind: 'dropShadow', color: K, dx: 1, dy: 0 })]).toEqual([R, K]);
  });
});
