import { describe, expect, it } from 'vitest';
import { DITHER_LEVELS } from './brush';
import { gradientHit, gradientLevel, gradientT } from './gradient';

describe('gradientT', () => {
  it('projects onto the drag line for linear gradients', () => {
    expect(gradientT('linear', 0, 0, 16, 0, 0, 5)).toBe(0);
    expect(gradientT('linear', 0, 0, 16, 0, 4, 9)).toBe(0.25);
    expect(gradientT('linear', 0, 0, 16, 0, 16, -3)).toBe(1);
    // Diagonal: (4, 0) projects halfway along (0, 0) → (4, 4).
    expect(gradientT('linear', 0, 0, 4, 4, 4, 0)).toBe(0.5);
    // Dragging the other way flips it.
    expect(gradientT('linear', 16, 0, 0, 0, 4, 0)).toBe(0.75);
  });

  it('measures distance over the radius for radial gradients', () => {
    expect(gradientT('radial', 0, 0, 0, 10, 0, 0)).toBe(0);
    expect(gradientT('radial', 0, 0, 0, 10, 3, 4)).toBe(0.5);
    expect(gradientT('radial', 0, 0, 0, 10, 6, -8)).toBe(1);
  });

  it('clamps to 0..1', () => {
    expect(gradientT('linear', 4, 0, 8, 0, 0, 0)).toBe(0);
    expect(gradientT('linear', 4, 0, 8, 0, 20, 0)).toBe(1);
    expect(gradientT('radial', 0, 0, 2, 0, 20, 20)).toBe(1);
  });

  it('is 0 everywhere for a zero-length drag', () => {
    expect(gradientT('linear', 3, 3, 3, 3, 7, 1)).toBe(0);
    expect(gradientT('radial', 3, 3, 3, 3, 7, 1)).toBe(0);
  });
});

describe('gradientHit', () => {
  const coverage = (t: number) => {
    let n = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (gradientHit(x, y, t)) n++;
    return n;
  };

  it('has 17 steps, each covering level/16 of a 4×4 tile with the end color', () => {
    for (let level = 0; level <= DITHER_LEVELS; level++) {
      const t = level / DITHER_LEVELS;
      expect(gradientLevel(t)).toBe(level);
      expect(coverage(t)).toBe(level);
    }
  });

  it('rounds to the nearest step', () => {
    expect(gradientLevel(0.49 / DITHER_LEVELS)).toBe(0);
    expect(gradientLevel(0.51 / DITHER_LEVELS)).toBe(1);
    expect(coverage(0)).toBe(0);
    expect(coverage(1)).toBe(16);
  });

  it('only ever adds end-color pixels as t grows', () => {
    for (let level = 0; level < DITHER_LEVELS; level++) {
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          if (gradientHit(x, y, level / DITHER_LEVELS)) {
            expect(gradientHit(x, y, (level + 1) / DITHER_LEVELS)).toBe(true);
          }
        }
      }
    }
  });
});
