import { describe, expect, it } from 'vitest';
import { rgba } from '@core/color';
import { RED, at, setup } from './testing';
import { TOOL_BY_ID } from './tools';

const BLUE = rgba(0, 0, 255);

describe('Gradient tool', () => {
  const row = (px: (x: number, y: number) => number, y: number, w = 8) =>
    Array.from({ length: w }, (_, x) => px(x, y));

  it('fills the layer from primary to secondary as one undo step', () => {
    const { ed, px, drag } = setup();
    ed.setSecondary(BLUE);
    drag('gradient', [0, 0], [7, 0]);
    for (let y = 0; y < 8; y++) {
      expect(px(0, y)).toBe(RED);
      expect(px(7, y)).toBe(BLUE);
    }
    expect(row(px, 3).every((c) => c === RED || c === BLUE)).toBe(true);
    expect(ed.getState().undoLabel).toBe('Gradient');

    ed.undo();
    expect(row(px, 0)).toEqual(Array(8).fill(0));
    expect(ed.getState().undoLabel).toBeUndefined();
  });

  it('draws radial gradients out from the start', () => {
    const { ed, px, drag } = setup();
    ed.setSecondary(BLUE);
    ed.setOption({ gradientKind: 'radial' });
    drag('gradient', [4, 4], [4, 0]);
    expect(px(4, 4)).toBe(RED);
    expect([px(0, 0), px(0, 4), px(4, 0), px(7, 7)]).toEqual([BLUE, BLUE, BLUE, BLUE]);
  });

  it('only fills the selection', () => {
    const { ed, px, drag } = setup();
    ed.setSecondary(BLUE);
    ed.select({ x: 2, y: 2, width: 3, height: 3 });
    drag('gradient', [2, 2], [4, 2]);
    expect(px(2, 3)).toBe(RED);
    expect(px(4, 3)).toBe(BLUE);
    expect([px(1, 3), px(5, 3), px(3, 1), px(3, 5), px(0, 0)]).toEqual([0, 0, 0, 0, 0]);

    // A masked selection clips to its mask.
    ed.select({ x: 0, y: 6, width: 2, height: 1, mask: Uint8Array.from([1, 0]) });
    drag('gradient', [0, 6], [7, 6]);
    expect([px(0, 6), px(1, 6)]).toEqual([RED, 0]);
  });

  it('swaps the colors on a right drag', () => {
    const { ed, px } = setup();
    ed.setSecondary(BLUE);
    const tool = TOOL_BY_ID.gradient;
    tool.down(ed, at(0, 0, { button: 2 }));
    tool.move(ed, at(7, 0, { button: 2 }));
    tool.up(ed, at(7, 0, { button: 2 }));
    expect([px(0, 0), px(7, 0)]).toEqual([BLUE, RED]);
  });

  it('snaps the angle with Shift', () => {
    const draw = (to: [number, number], shift: boolean) => {
      const { ed, px, drag } = setup();
      ed.setSecondary(BLUE);
      drag('gradient', [0, 0], to, shift);
      return Array.from({ length: 8 }, (_, y) => row(px, y));
    };
    const horizontal = draw([7, 0], false);
    // (7, 1) snaps to (7, 0).
    expect(draw([7, 1], true)).toEqual(horizontal);
    expect(draw([7, 1], false)).not.toEqual(horizontal);
  });

  it('keeps every pixel in the palette in indexed mode', () => {
    const { ed, px, drag } = setup(8, 2);
    ed.setPalette([RED, BLUE]);
    ed.setIndexed(true);
    ed.setPrimary(rgba(250, 10, 10, 200));
    ed.setSecondary(rgba(10, 10, 240, 128));
    drag('gradient', [0, 0], [7, 0]);
    const all = [...row(px, 0), ...row(px, 1)];
    expect(all.every((c) => c === RED || c === BLUE)).toBe(true);
    expect([px(0, 0), px(7, 0)]).toEqual([RED, BLUE]);
  });

  it('ignores brush size, dither and symmetry', () => {
    const { ed, px, drag } = setup();
    ed.setSecondary(BLUE);
    ed.setBrushSize(5);
    ed.setOption({ dither: 4, mirrorX: true });
    drag('gradient', [0, 0], [7, 0]);
    expect(row(px, 0).every((c) => c === RED || c === BLUE)).toBe(true);
    expect([px(0, 0), px(7, 0)]).toEqual([RED, BLUE]);
  });

  it('leaves the layer alone on a click', () => {
    const { ed, px, drag } = setup();
    drag('gradient', [3, 3], [3, 3]);
    expect(row(px, 3)).toEqual(Array(8).fill(0));
    expect(ed.getState().undoLabel).toBeUndefined();
  });
});

describe('Rectangle radius', () => {
  it('rounds the corners', () => {
    const { ed, px, drag } = setup(7, 7);
    ed.setOption({ shapeRadius: 2 });
    drag('rect', [0, 0], [6, 6]);
    expect([px(0, 0), px(1, 0), px(2, 0), px(1, 1), px(0, 2)]).toEqual([0, 0, RED, RED, RED]);
    expect(ed.getState().undoLabel).toBe('Rectangle');
  });

  it('draws square corners at radius 0', () => {
    const { px, drag } = setup(7, 7);
    drag('rect', [0, 0], [6, 6]);
    expect(px(0, 0)).toBe(RED);
  });
});

describe('Polygon tool', () => {
  it('outlines a regular polygon from the center as one undo step', () => {
    const { ed, px, drag } = setup(11, 11);
    ed.setOption({ polygonSides: 4 });
    drag('polygon', [5, 5], [5, 1]);
    expect([px(5, 1), px(9, 5), px(5, 9), px(1, 5), px(7, 3)]).toEqual([RED, RED, RED, RED, RED]);
    expect(px(5, 5)).toBe(0);
    expect(ed.getState().undoLabel).toBe('Polygon');
    ed.undo();
    expect(px(5, 1)).toBe(0);
  });

  it('defaults to a pentagon', () => {
    const { px, drag } = setup(11, 10);
    drag('polygon', [5, 5], [5, 0]);
    expect([px(5, 0), px(10, 3), px(8, 9), px(2, 9), px(0, 3)]).toEqual([RED, RED, RED, RED, RED]);
  });

  it('fills, dithers and uses the brush like other shapes', () => {
    const { ed, px, drag } = setup(11, 11);
    ed.setOption({ polygonSides: 4, shapeFilled: true });
    drag('polygon', [5, 5], [5, 1]);
    expect(px(5, 5)).toBe(RED);

    const b = setup(11, 11);
    b.ed.setOption({ polygonSides: 4, shapeFilled: true, dither: 8 });
    b.drag('polygon', [5, 5], [5, 1]);
    expect([b.px(5, 5), b.px(4, 5)]).toEqual([RED, 0]);

    const c = setup(11, 11);
    c.ed.setOption({ polygonSides: 4 });
    c.ed.setBrushSize(3);
    c.drag('polygon', [5, 5], [5, 2]);
    expect(c.px(5, 1)).toBe(RED);
  });

  it('mirrors with symmetry', () => {
    const { ed, px, drag } = setup(11, 11);
    ed.setOption({ polygonSides: 4, mirrorX: true });
    drag('polygon', [2, 5], [2, 3]);
    expect([px(2, 3), px(8, 3)]).toEqual([RED, RED]);
  });

  it('snaps the rotation to 15° with Shift', () => {
    const plain = setup(24, 24);
    plain.ed.setOption({ polygonSides: 4 });
    plain.drag('polygon', [10, 10], [20, 11]);
    expect([plain.px(20, 11), plain.px(20, 10)]).toEqual([RED, 0]);

    const snapped = setup(24, 24);
    snapped.ed.setOption({ polygonSides: 4 });
    snapped.drag('polygon', [10, 10], [20, 11], true);
    expect([snapped.px(20, 10), snapped.px(10, 20)]).toEqual([RED, RED]);
  });
});
