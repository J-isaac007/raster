import { describe, expect, it } from 'vitest';
import { RED, at, setup } from './testing';
import { TOOL_BY_ID } from './tools';

describe('Editor tile mode', () => {
  it('wraps strokes across the edges', () => {
    const { ed, px, drag } = setup(4, 4);
    ed.setOption({ tileMode: 'both' });
    drag('pencil', [-1, -1], [-1, -1]);
    expect(px(3, 3)).toBe(RED);
    drag('line', [2, 1], [5, 1]);
    expect([0, 1, 2, 3].map((x) => px(x, 1))).toEqual([RED, RED, RED, RED]);
  });

  it('wraps only the chosen axis', () => {
    const { ed, px, drag } = setup(4, 4);
    ed.setOption({ tileMode: 'x' });
    drag('pencil', [4, 0], [4, 0]);
    drag('pencil', [0, 4], [0, 4]);
    expect(px(0, 0)).toBe(RED);
    expect(ed.activeLayer.pixels.filter((c) => c !== 0)).toHaveLength(1);
  });

  it('fills and picks from wrapped points', () => {
    const { ed, px } = setup(2, 2);
    ed.setOption({ tileMode: 'both' });
    TOOL_BY_ID.fill.down(ed, at(5, 5));
    expect(px(1, 1)).toBe(RED);
    ed.setPrimary(0);
    TOOL_BY_ID.picker.down(ed, at(-1, -1));
    expect(ed.getState().primary).toBe(RED);
  });
});
