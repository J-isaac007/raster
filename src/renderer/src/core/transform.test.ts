import { describe, expect, it } from 'vitest';
import { rgba } from './color';
import type { Surface } from './sprite';
import {
  contentBounds,
  flipSurface,
  rotSprite,
  rotateQuarter,
  scale2x,
  scaleNearest,
  transformSurface,
} from './transform';

const A = rgba(255, 0, 0);
const B = rgba(0, 255, 0);
const C = rgba(0, 0, 255);
const D = rgba(255, 255, 0);

/** 2×3, rows top to bottom: [A B] [C D] [0 0]. */
const sample = (): Surface => ({
  width: 2,
  height: 3,
  pixels: Uint32Array.from([A, B, C, D, 0, 0]),
});

const colors = (s: Surface) => new Set([...s.pixels].filter((c) => c !== 0));

describe('rotateQuarter', () => {
  it('turns clockwise, swapping width and height', () => {
    const r = rotateQuarter(sample(), 1);
    expect([r.width, r.height]).toEqual([3, 2]);
    // Rows: [0 C A] [0 D B]
    expect([...r.pixels]).toEqual([0, C, A, 0, D, B]);
  });

  it('turns counterclockwise and half way', () => {
    expect([...rotateQuarter(sample(), -1).pixels]).toEqual([B, D, 0, A, C, 0]);
    expect([...rotateQuarter(sample(), 2).pixels]).toEqual([0, 0, D, C, B, A]);
  });

  it('comes back after four turns, and never edits the source', () => {
    const src = sample();
    let s = src;
    for (let i = 0; i < 4; i++) s = rotateQuarter(s, 1);
    expect([...s.pixels]).toEqual([...src.pixels]);
    expect([...src.pixels]).toEqual([A, B, C, D, 0, 0]);
  });
});

describe('flipSurface', () => {
  it('mirrors rows or columns', () => {
    expect([...flipSurface(sample(), 'horizontal').pixels]).toEqual([B, A, D, C, 0, 0]);
    expect([...flipSurface(sample(), 'vertical').pixels]).toEqual([0, 0, C, D, A, B]);
  });
});

describe('scaleNearest', () => {
  it('repeats pixels when growing and drops them when shrinking', () => {
    const big = scaleNearest(sample(), 4, 6);
    expect(big.pixels[0]).toBe(A);
    expect(big.pixels[1]).toBe(A);
    expect(big.pixels[2]).toBe(B);
    expect(big.pixels[4 * 2]).toBe(C);
    const back = scaleNearest(big, 2, 3);
    expect([...back.pixels]).toEqual([...sample().pixels]);
  });
});

describe('scale2x', () => {
  it('keeps flat areas flat and smooths a diagonal step', () => {
    const flat = scale2x({ width: 2, height: 2, pixels: new Uint32Array(4).fill(A) });
    expect([...flat.pixels].every((c) => c === A)).toBe(true);
    // An L of A around an empty corner: the empty cell's top-left quarter,
    // between its A neighbors above and to the left, fills in.
    const step = scale2x({ width: 2, height: 2, pixels: Uint32Array.from([A, A, A, 0]) });
    expect([step.width, step.height]).toEqual([4, 4]);
    expect(step.pixels[2 * 4 + 2]).toBe(A);
    expect([step.pixels[2 * 4 + 3], step.pixels[3 * 4 + 2], step.pixels[3 * 4 + 3]]).toEqual([
      0, 0, 0,
    ]);
  });
});

describe('rotSprite', () => {
  it('uses exact quarter turns for multiples of 90', () => {
    expect([...rotSprite(sample(), 90).pixels]).toEqual([...rotateQuarter(sample(), 1).pixels]);
    expect([...rotSprite(sample(), -90).pixels]).toEqual([...rotateQuarter(sample(), -1).pixels]);
  });

  it('grows to the rotated bounding box and adds no new colors', () => {
    const square: Surface = { width: 8, height: 8, pixels: new Uint32Array(64) };
    for (let i = 0; i < 32; i++) square.pixels[i] = A;
    for (let i = 32; i < 64; i++) square.pixels[i] = B;
    const r = rotSprite(square, 45);
    expect(r.width).toBe(12); // ceil(8√2)
    expect(r.height).toBe(12);
    expect(colors(r)).toEqual(new Set([A, B]));
    // Corners of the bounding box are outside the turned square.
    expect(r.pixels[0]).toBe(0);
  });

  it('turns clockwise: the top half ends up on the right at 90°-ish', () => {
    const s: Surface = { width: 8, height: 8, pixels: new Uint32Array(64) };
    for (let i = 0; i < 32; i++) s.pixels[i] = A; // top half
    const r = rotSprite(s, 80);
    const mid = Math.floor(r.height / 2) * r.width;
    expect(r.pixels[mid + r.width - 3]).toBe(A);
    expect(r.pixels[mid + 2]).toBe(0);
  });
});

describe('transformSurface', () => {
  it('scales then rotates', () => {
    const r = transformSurface(sample(), { angle: 90, scaleX: 2, scaleY: 1 });
    expect([r.width, r.height]).toEqual([3, 4]);
    expect(colors(r)).toEqual(new Set([A, B, C, D]));
  });
});

describe('contentBounds', () => {
  it('finds the box around painted pixels across buffers', () => {
    const a = new Uint32Array(16);
    const b = new Uint32Array(16);
    a[1 * 4 + 1] = A;
    b[2 * 4 + 3] = B;
    expect(contentBounds(4, 4, [a, b])).toEqual({ x: 1, y: 1, width: 3, height: 2 });
    expect(contentBounds(4, 4, [new Uint32Array(16)])).toBeNull();
  });
});
