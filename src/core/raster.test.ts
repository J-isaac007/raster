import { describe, expect, it } from 'vitest';
import {
  floodRegion,
  intersectRect,
  plotBrush,
  plotEllipse,
  plotLine,
  plotRect,
  rectFromCorners,
  snapAngle,
  snapSquare,
  type Plot,
} from './raster';
import type { Surface } from './sprite';

function collect(draw: (plot: Plot) => void): string[] {
  const set = new Set<string>();
  draw((x, y) => set.add(`${x},${y}`));
  return [...set].sort();
}

function render(w: number, h: number, draw: (plot: Plot) => void): string {
  const grid = Array.from({ length: h }, () => Array(w).fill('.'));
  draw((x, y) => {
    if (x >= 0 && y >= 0 && x < w && y < h) grid[y][x] = '#';
  });
  return grid.map((r) => r.join('')).join('\n');
}

function surface(rows: string[]): Surface {
  const height = rows.length;
  const width = rows[0].length;
  const pixels = new Uint32Array(width * height);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => (pixels[y * width + x] = ch === '#' ? 1 : 0)),
  );
  return { width, height, pixels };
}

describe('plotLine', () => {
  it('includes both endpoints', () => {
    expect(collect((p) => plotLine(0, 0, 3, 0, p))).toEqual(['0,0', '1,0', '2,0', '3,0']);
    expect(collect((p) => plotLine(2, 2, 2, 2, p))).toEqual(['2,2']);
  });

  it('draws diagonals one pixel per step', () => {
    expect(collect((p) => plotLine(3, 3, 0, 0, p))).toEqual(['0,0', '1,1', '2,2', '3,3']);
  });
});

describe('plotRect', () => {
  it('draws outlines and fills', () => {
    expect(render(4, 3, (p) => plotRect(3, 2, 0, 0, false, p))).toBe('####\n#..#\n####');
    expect(render(3, 2, (p) => plotRect(0, 0, 2, 1, true, p))).toBe('###\n###');
  });
});

describe('plotEllipse', () => {
  it('draws a symmetric circle', () => {
    expect(render(5, 5, (p) => plotEllipse(0, 0, 4, 4, false, p))).toBe(
      ['.###.', '#...#', '#...#', '#...#', '.###.'].join('\n'),
    );
  });

  it('fills', () => {
    expect(render(5, 5, (p) => plotEllipse(0, 0, 4, 4, true, p))).toBe(
      ['.###.', '#####', '#####', '#####', '.###.'].join('\n'),
    );
  });

  it('handles degenerate boxes', () => {
    expect(collect((p) => plotEllipse(1, 1, 1, 1, false, p))).toEqual(['1,1']);
    expect(render(4, 1, (p) => plotEllipse(0, 0, 3, 0, false, p))).toBe('####');
  });
});

describe('plotBrush', () => {
  it('centers odd and even brushes', () => {
    expect(collect((p) => plotBrush(5, 5, 1, p))).toEqual(['5,5']);
    expect(collect((p) => plotBrush(5, 5, 3, p))).toHaveLength(9);
    expect(collect((p) => plotBrush(5, 5, 2, p))).toEqual(['5,5', '5,6', '6,5', '6,6']);
  });
});

describe('floodRegion', () => {
  const s = surface(['..#..', '..#..', '###..', '.....']);

  it('fills the 4-connected region only', () => {
    expect(floodRegion(s, 0, 0).length).toBe(4);
    expect(floodRegion(s, 4, 0).length).toBe(11);
  });

  it('matches all pixels of the color when not contiguous', () => {
    expect(floodRegion(s, 0, 0, false).length).toBe(15);
  });

  it('ignores out-of-bounds starts', () => {
    expect(floodRegion(s, -1, 0).length).toBe(0);
  });
});

describe('snapping', () => {
  it('snaps lines to 0/45/90 degrees', () => {
    expect(snapAngle(0, 0, 10, 2)).toEqual([10, 0]);
    expect(snapAngle(0, 0, 1, 9)).toEqual([0, 9]);
    expect(snapAngle(0, 0, 5, -4)).toEqual([5, -5]);
  });

  it('snaps boxes to squares', () => {
    expect(snapSquare(0, 0, 4, 2)).toEqual([4, 4]);
    expect(snapSquare(5, 5, 3, 0)).toEqual([0, 0]);
  });
});

describe('rects', () => {
  it('builds a rect from corners in any order', () => {
    expect(rectFromCorners(3, 1, 0, 2)).toEqual({ x: 0, y: 1, width: 4, height: 2 });
  });

  it('intersects rects', () => {
    const a = { x: 0, y: 0, width: 4, height: 4 };
    expect(intersectRect(a, { x: 2, y: -1, width: 5, height: 2 })).toEqual({
      x: 2,
      y: 0,
      width: 2,
      height: 1,
    });
    expect(intersectRect(a, { x: 4, y: 0, width: 1, height: 1 })).toBeNull();
  });

  it('bounds a flood fill', () => {
    const s: Surface = { width: 4, height: 1, pixels: new Uint32Array(4) };
    expect([...floodRegion(s, 1, 0, true, { x: 1, y: 0, width: 2, height: 1 })]).toEqual([1, 2]);
    expect([...floodRegion(s, 1, 0, false, { x: 0, y: 0, width: 2, height: 1 })]).toEqual([0, 1]);
    expect(floodRegion(s, 3, 0, true, { x: 0, y: 0, width: 2, height: 1 })).toHaveLength(0);
  });
});
