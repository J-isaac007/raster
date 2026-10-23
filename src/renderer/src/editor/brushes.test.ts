import { describe, expect, it } from 'vitest';
import { rgba } from '@core/color';
import { RED, at, setup } from './testing';
import { TOOL_BY_ID } from './tools';

describe('Editor brushes', () => {
  it('dithers paint through a checkerboard at 50%', () => {
    const { ed, px, drag } = setup();
    ed.setOption({ dither: 8 });
    drag('line', [0, 0], [3, 0]);
    expect([0, 1, 2, 3].map((x) => px(x, 0))).toEqual([RED, 0, RED, 0]);
  });

  it('dithers fills', () => {
    const { ed, px } = setup(4, 4);
    ed.setOption({ dither: 8 });
    TOOL_BY_ID.fill.down(ed, at(0, 0));
    expect([px(0, 0), px(1, 0), px(0, 1), px(1, 1)]).toEqual([RED, 0, 0, RED]);
  });

  it('removes L corners in pixel-perfect mode', () => {
    const { ed, px } = setup();
    ed.setOption({ pixelPerfect: true });
    const pencil = TOOL_BY_ID.pencil;
    pencil.down(ed, at(0, 0));
    pencil.move(ed, at(1, 0));
    pencil.move(ed, at(1, 1));
    pencil.up(ed, at(1, 1));
    expect([px(0, 0), px(1, 0), px(1, 1)]).toEqual([RED, 0, RED]);
  });

  it('shades along the palette ramp, once per stroke', () => {
    const { ed, px, drag } = setup();
    const ramp = [rgba(10, 10, 10), rgba(50, 50, 50), rgba(90, 90, 90)];
    ed.setPalette(ramp);
    ed.setPrimary(ramp[0]);
    drag('pencil', [0, 0], [2, 0]);
    const shade = TOOL_BY_ID.shade;
    shade.down(ed, at(0, 0));
    shade.move(ed, at(1, 0));
    shade.move(ed, at(0, 0));
    shade.up(ed, at(0, 0));
    expect([px(0, 0), px(1, 0), px(2, 0)]).toEqual([ramp[1], ramp[1], ramp[0]]);
    drag('shade', [1, 0], [1, 0]);
    expect(px(1, 0)).toBe(ramp[2]);
  });
});

describe('Editor custom brushes', () => {
  const BLUE = rgba(0, 0, 255);

  /** Draws an L of RED/BLUE in the top-left and turns it into the brush. */
  function withBrush() {
    const t = setup(10, 10);
    t.drag('pencil', [0, 0], [0, 0]);
    t.ed.setPrimary(BLUE);
    t.drag('pencil', [0, 1], [1, 1]);
    t.ed.select({ x: 0, y: 0, width: 3, height: 3 });
    t.ed.brushFromSelection();
    return t;
  }

  it('makes a trimmed brush from the selection and deselects', () => {
    const { ed } = withBrush();
    const s = ed.getState();
    expect(s.customBrush).toMatchObject({ width: 2, height: 2 });
    expect(s.selection).toBeNull();
    expect(s.tool).toBe('pencil');
  });

  it('stamps the brush colors centered on the cursor', () => {
    const { ed, px, drag } = withBrush();
    ed.setPrimary(rgba(0, 255, 0));
    drag('pencil', [6, 6], [6, 6]);
    // 2×2 brush: hot spot is its top-left pixel.
    expect([px(6, 6), px(6, 7), px(7, 7), px(7, 6)]).toEqual([RED, BLUE, BLUE, 0]);
  });

  it('paints the current color in the brush shape in color mode', () => {
    const { ed, px, drag } = withBrush();
    const green = rgba(0, 255, 0);
    ed.setOption({ brushMode: 'color' });
    ed.setPrimary(green);
    drag('pencil', [6, 6], [6, 6]);
    expect([px(6, 6), px(6, 7), px(7, 7), px(7, 6)]).toEqual([green, green, green, 0]);
  });

  it('erases in the brush shape', () => {
    const { ed, px, drag } = withBrush();
    ed.setPrimary(BLUE);
    ed.setBrushSize(3);
    drag('pencil', [7, 7], [7, 7]);
    ed.select({ x: 0, y: 0, width: 3, height: 3 });
    ed.brushFromSelection();
    drag('eraser', [6, 6], [6, 6]);
    expect([px(6, 6), px(6, 7), px(7, 7), px(7, 6)]).toEqual([0, 0, 0, BLUE]);
  });

  it('mirrors stamps', () => {
    const { ed, px, drag } = withBrush();
    ed.setOption({ mirrorX: true });
    drag('pencil', [2, 5], [2, 5]);
    expect([px(2, 5), px(7, 5)]).toEqual([RED, RED]);
    expect([px(3, 6), px(6, 6)]).toEqual([BLUE, BLUE]);
  });

  it('goes back to the square brush on request or when a size is picked', () => {
    const { ed } = withBrush();
    ed.clearCustomBrush();
    expect(ed.getState().customBrush).toBeNull();
    ed.select({ x: 0, y: 0, width: 3, height: 3 });
    ed.brushFromSelection();
    ed.setBrushSize(2);
    expect(ed.getState().customBrush).toBeNull();
  });

  it('refuses an empty selection', () => {
    const { ed } = setup();
    ed.select({ x: 4, y: 4, width: 2, height: 2 });
    ed.brushFromSelection();
    expect(ed.getState().customBrush).toBeNull();
    expect(ed.getState().message).toBe('The selection is empty');
  });
});
