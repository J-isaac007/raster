import { describe, expect, it } from 'vitest';
import { rgba } from './color';
import {
  clearSelection,
  clipSelection,
  colorSelection,
  combineSelections,
  copySelection,
  invertSelection,
  polygonSelection,
  selectionOutline,
} from './mask';
import { selectionContains, type Selection } from './raster';
import type { Surface } from './sprite';

/** Draws the selection on a w × h grid: `#` selected, `.` not. */
function show(sel: Selection | null, w: number, h: number): string {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += sel && selectionContains(sel, x, y) ? '#' : '.';
    rows.push(row);
  }
  return rows.join('\n');
}

const A = rgba(255, 0, 0);
const B = rgba(0, 0, 255);

function surface(rows: string[]): Surface {
  const height = rows.length;
  const width = rows[0].length;
  const pixels = new Uint32Array(width * height);
  rows.forEach((r, y) => [...r].forEach((c, x) => (pixels[y * width + x] = c === 'a' ? A : B)));
  return { width, height, pixels };
}

describe('polygonSelection', () => {
  it('fills a closed lasso path, outline included', () => {
    const sel = polygonSelection(
      [
        { x: 1, y: 0 },
        { x: 4, y: 3 },
        { x: 1, y: 3 },
      ],
      6,
      5,
    );
    expect(show(sel, 6, 5)).toBe(['.#....', '.##...', '.###..', '.####.', '......'].join('\n'));
    expect(sel).toMatchObject({ x: 1, y: 0, width: 4, height: 4 });
  });

  it('drops the mask when the path covers its whole bounding box', () => {
    const sel = polygonSelection(
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 1, y: 2 },
      ],
      5,
      5,
    );
    expect(sel).toEqual({ x: 1, y: 1, width: 3, height: 2 });
  });

  it('clips to the canvas', () => {
    const sel = polygonSelection(
      [
        { x: -3, y: -3 },
        { x: 2, y: -3 },
        { x: 2, y: 1 },
        { x: -3, y: 1 },
      ],
      4,
      4,
    );
    expect(sel).toEqual({ x: 0, y: 0, width: 3, height: 2 });
  });
});

describe('colorSelection', () => {
  const s = surface(['aab', 'bab', 'aba']);

  it('selects the connected region of one color', () => {
    expect(show(colorSelection(s, 0, 0, true), 3, 3)).toBe(['##.', '.#.', '...'].join('\n'));
  });

  it('selects every pixel of that color when not contiguous', () => {
    expect(show(colorSelection(s, 0, 0, false), 3, 3)).toBe(['##.', '.#.', '#.#'].join('\n'));
  });

  it('selects nothing outside the canvas', () => {
    expect(colorSelection(s, 5, 0, true)).toBeNull();
  });
});

describe('combineSelections', () => {
  const left = { x: 0, y: 0, width: 2, height: 2 };
  const right = { x: 1, y: 1, width: 2, height: 2 };

  it('adds and subtracts', () => {
    expect(show(combineSelections(left, right, 'add', 4, 4), 4, 4)).toBe(
      ['##..', '###.', '.##.', '....'].join('\n'),
    );
    expect(show(combineSelections(left, right, 'subtract', 4, 4), 4, 4)).toBe(
      ['##..', '#...', '....', '....'].join('\n'),
    );
  });

  it('replaces, and handles missing selections', () => {
    expect(combineSelections(left, right, 'replace', 4, 4)).toEqual(right);
    expect(combineSelections(null, right, 'add', 4, 4)).toEqual(right);
    expect(combineSelections(null, right, 'subtract', 4, 4)).toBeNull();
    expect(combineSelections(left, left, 'subtract', 4, 4)).toBeNull();
  });
});

describe('invertSelection', () => {
  it('selects everything else', () => {
    const inv = invertSelection({ x: 1, y: 1, width: 2, height: 1 }, 3, 3);
    expect(show(inv, 3, 3)).toBe(['###', '#..', '###'].join('\n'));
    expect(invertSelection(null, 3, 3)).toEqual({ x: 0, y: 0, width: 3, height: 3 });
    expect(invertSelection(inv, 3, 3)).toEqual({ x: 1, y: 1, width: 2, height: 1 });
  });
});

describe('clipSelection', () => {
  it('trims a masked selection to the canvas', () => {
    const sel: Selection = { x: -1, y: 0, width: 3, height: 1, mask: Uint8Array.of(1, 0, 1) };
    expect(clipSelection(sel, 4, 4)).toEqual({ x: 1, y: 0, width: 1, height: 1 });
  });
});

describe('copySelection and clearSelection', () => {
  const sel: Selection = { x: 0, y: 0, width: 2, height: 2, mask: Uint8Array.of(1, 0, 0, 1) };

  it('copies only selected pixels', () => {
    const s = surface(['aa', 'aa']);
    expect([...copySelection(s, sel).pixels]).toEqual([A, 0, 0, A]);
  });

  it('clears only selected pixels', () => {
    const s = surface(['aa', 'aa']);
    clearSelection(s, sel);
    expect([...s.pixels]).toEqual([0, A, A, 0]);
  });
});

describe('selectionOutline', () => {
  it('is the four sides of a rectangle', () => {
    expect(selectionOutline({ x: 1, y: 2, width: 3, height: 1 })).toEqual([
      [1, 2, 4, 2],
      [4, 2, 4, 3],
      [1, 3, 4, 3],
      [1, 2, 1, 3],
    ]);
  });

  it('follows a mask along pixel edges, joining runs', () => {
    // An L shape: #. / ##
    const sel: Selection = { x: 0, y: 0, width: 2, height: 2, mask: Uint8Array.of(1, 0, 1, 1) };
    const edges = selectionOutline(sel);
    expect(edges).toHaveLength(6);
    expect(edges).toContainEqual([0, 2, 2, 2]);
    expect(edges).toContainEqual([0, 0, 0, 2]);
    expect(edges).toContainEqual([1, 1, 2, 1]);
  });
});
