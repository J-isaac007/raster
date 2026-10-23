import { describe, expect, it } from 'vitest';
import { rgba } from '@core/color';
import { selectionContains } from '@core/raster';
import type { Editor } from './editor';
import { RED, at, setup } from './testing';
import { TOOL_BY_ID } from './tools';

describe('Editor selection', () => {
  const BLUE = rgba(0, 0, 255);

  it('selects by dragging and deselects on a click', () => {
    const { ed, drag } = setup();
    drag('select', [5, 6], [2, 1]);
    expect(ed.getState().selection).toEqual({ x: 2, y: 1, width: 4, height: 6 });
    drag('select', [0, 0], [0, 0]);
    expect(ed.getState().selection).toBeNull();
  });

  it('clips the selection to the canvas', () => {
    const { ed } = setup();
    ed.select({ x: -2, y: 6, width: 4, height: 9 });
    expect(ed.getState().selection).toEqual({ x: 0, y: 6, width: 2, height: 2 });
    ed.selectAll();
    expect(ed.getState().selection).toEqual({ x: 0, y: 0, width: 8, height: 8 });
    ed.deselect();
    expect(ed.getState().selection).toBeNull();
  });

  it('clips drawing tools to the selection', () => {
    const { ed, px, drag } = setup();
    ed.select({ x: 2, y: 0, width: 2, height: 8 });
    drag('pencil', [0, 0], [7, 0]);
    expect([0, 1, 2, 3, 4].map((x) => px(x, 0))).toEqual([0, 0, RED, RED, 0]);
    ed.setPrimary(BLUE);
    TOOL_BY_ID.fill.down(ed, at(3, 4));
    expect(px(3, 4)).toBe(BLUE);
    expect(px(1, 4)).toBe(0);
    expect(px(4, 4)).toBe(0);
    TOOL_BY_ID.fill.down(ed, at(6, 6));
    expect(px(6, 6)).toBe(0);
  });

  it('moves selected pixels as one undo step, committed on deselect', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [1, 1], [2, 1]);
    ed.select({ x: 1, y: 1, width: 2, height: 1 });
    ed.setTool('select');
    drag('select', [1, 1], [3, 2]);
    drag('select', [3, 2], [4, 3]);
    expect(px(1, 1)).toBe(0);
    expect([px(4, 3), px(5, 3)]).toEqual([RED, RED]);
    expect(ed.getState().selection).toEqual({ x: 4, y: 3, width: 2, height: 1 });
    expect(ed.hasFloating).toBe(true);

    ed.deselect();
    expect(ed.hasFloating).toBe(false);
    expect(ed.getState().undoLabel).toBe('Move');
    ed.undo();
    expect([px(1, 1), px(2, 1), px(4, 3)]).toEqual([RED, RED, 0]);
    expect(ed.getState().undoLabel).toBe('Pencil');
    ed.redo();
    expect([px(1, 1), px(4, 3), px(5, 3)]).toEqual([0, RED, RED]);
  });

  it('commits floating pixels on tool change', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [0, 0], [0, 0]);
    ed.setTool('select');
    ed.select({ x: 0, y: 0, width: 1, height: 1 });
    drag('select', [0, 0], [2, 2]);
    ed.setTool('pencil');
    expect(ed.hasFloating).toBe(false);
    expect(px(2, 2)).toBe(RED);
    expect(ed.getState().undoLabel).toBe('Move');
  });

  it('copies and pastes as a floating selection', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [0, 0], [1, 0]);
    ed.select({ x: 0, y: 0, width: 2, height: 1 });
    expect(ed.copy()?.pixels).toEqual(Uint32Array.of(RED, RED));
    ed.deselect();
    ed.paste();
    expect(ed.getState().selection).toEqual({ x: 3, y: 3, width: 2, height: 1 });
    expect(px(3, 3)).toBe(RED);
    ed.moveFloating(5, 7);
    ed.deselect();
    expect([px(3, 3), px(5, 7), px(6, 7)]).toEqual([0, RED, RED]);
    expect(ed.getState().undoLabel).toBe('Paste');
    ed.undo();
    expect(px(5, 7)).toBe(0);
    expect(px(0, 0)).toBe(RED);
  });

  it('pastes external pixels at the selection corner', () => {
    const { ed, px } = setup();
    ed.select({ x: 6, y: 6, width: 1, height: 1 });
    ed.paste({ width: 3, height: 1, pixels: Uint32Array.of(BLUE, BLUE, BLUE) });
    ed.deselect();
    expect([px(6, 6), px(7, 6)]).toEqual([BLUE, BLUE]);
  });

  it('cuts and deletes selected pixels', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [0, 0], [3, 0]);
    ed.select({ x: 0, y: 0, width: 2, height: 1 });
    expect(ed.cut()?.pixels).toEqual(Uint32Array.of(RED, RED));
    expect([px(0, 0), px(1, 0), px(2, 0)]).toEqual([0, 0, RED]);
    expect(ed.getState().undoLabel).toBe('Cut');
    ed.select({ x: 3, y: 0, width: 1, height: 1 });
    ed.deleteSelection();
    expect(px(3, 0)).toBe(0);
    expect(px(2, 0)).toBe(RED);
    ed.undo();
    ed.undo();
    expect([px(0, 0), px(3, 0)]).toEqual([RED, RED]);
  });

  it('deletes floating pixels in one undo step', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [0, 0], [0, 0]);
    ed.select({ x: 0, y: 0, width: 1, height: 1 });
    ed.liftSelection();
    ed.moveFloating(4, 4);
    ed.deleteSelection();
    expect([px(0, 0), px(4, 4)]).toEqual([0, 0]);
    ed.undo();
    expect([px(0, 0), px(4, 4)]).toEqual([RED, 0]);
  });

  it('will not move pixels on a locked layer', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [0, 0], [0, 0]);
    ed.select({ x: 0, y: 0, width: 1, height: 1 });
    ed.updateLayer(ed.activeLayer.id, { locked: true });
    expect(ed.liftSelection()).toBe(false);
    expect(ed.cut()).toBeNull();
    expect(px(0, 0)).toBe(RED);
  });
});

describe('Editor lasso and magic wand', () => {
  const BLUE = rgba(0, 0, 255);
  const selected = (ed: Editor) => {
    const sel = ed.getState().selection;
    const out: string[] = [];
    for (let y = 0; y < ed.sprite.height; y++) {
      for (let x = 0; x < ed.sprite.width; x++) {
        if (sel && selectionContains(sel, x, y)) out.push(`${x},${y}`);
      }
    }
    return out;
  };

  it('selects the area inside a lasso path, and deselects on a click', () => {
    const { ed } = setup();
    const lasso = TOOL_BY_ID.lasso;
    lasso.down(ed, at(1, 1));
    lasso.move(ed, at(3, 1));
    lasso.move(ed, at(3, 3));
    lasso.up(ed, at(1, 3));
    expect(ed.getState().selection).toEqual({ x: 1, y: 1, width: 3, height: 3 });
    lasso.down(ed, at(6, 6));
    lasso.up(ed, at(6, 6));
    expect(ed.getState().selection).toBeNull();
  });

  it('adds with Shift and subtracts with Ctrl', () => {
    const { ed } = setup();
    const lasso = TOOL_BY_ID.lasso;
    ed.select({ x: 0, y: 0, width: 2, height: 1 });
    lasso.down(ed, at(4, 0, { shift: true }));
    lasso.up(ed, at(5, 0, { shift: true }));
    expect(selected(ed)).toEqual(['0,0', '1,0', '4,0', '5,0']);
    lasso.down(ed, at(1, 0, { ctrl: true }));
    lasso.up(ed, at(4, 0, { ctrl: true }));
    expect(selected(ed)).toEqual(['0,0', '5,0']);
  });

  it('selects matching pixels with the magic wand', () => {
    const { ed, drag } = setup(4, 4);
    drag('pencil', [0, 0], [1, 0]);
    drag('pencil', [3, 3], [3, 3]);
    const wand = TOOL_BY_ID.wand;
    wand.down(ed, at(0, 0));
    wand.up(ed, at(0, 0));
    expect(ed.getState().selection).toEqual({ x: 0, y: 0, width: 2, height: 1 });
    ed.setOption({ wandContiguous: false });
    wand.down(ed, at(0, 0));
    wand.up(ed, at(0, 0));
    expect(selected(ed)).toEqual(['0,0', '1,0', '3,3']);
    ed.setOption({ wandContiguous: true });
    wand.down(ed, at(3, 3, { ctrl: true }));
    wand.up(ed, at(3, 3, { ctrl: true }));
    expect(selected(ed)).toEqual(['0,0', '1,0']);
  });

  it('clips strokes to a masked selection', () => {
    const { ed, px, drag } = setup(4, 4);
    drag('pencil', [1, 1], [1, 1]);
    ed.setOption({ wandContiguous: false });
    ed.selectColor(1, 1);
    ed.invertSelection();
    ed.setPrimary(BLUE);
    TOOL_BY_ID.fill.down(ed, at(0, 0));
    expect([px(0, 0), px(1, 1), px(3, 3)]).toEqual([BLUE, RED, BLUE]);
  });

  it('moves only the masked pixels', () => {
    const { ed, px, drag } = setup(4, 4);
    drag('pencil', [0, 0], [1, 0]);
    ed.setPrimary(BLUE);
    drag('pencil', [0, 1], [1, 1]);
    // Select the two red pixels plus (0, 1): an L-shaped mask.
    ed.selectColor(0, 0);
    ed.select({ x: 0, y: 1, width: 1, height: 1 }, 'add');
    expect(ed.getState().selection?.mask).toBeDefined();
    const wand = TOOL_BY_ID.wand;
    wand.down(ed, at(0, 0));
    wand.move(ed, at(2, 2));
    wand.up(ed, at(2, 2));
    ed.deselect();
    expect([px(0, 0), px(1, 0), px(0, 1), px(1, 1)]).toEqual([0, 0, 0, BLUE]);
    expect([px(2, 2), px(3, 2), px(2, 3), px(3, 3)]).toEqual([RED, RED, BLUE, 0]);
    expect(ed.getState().undoLabel).toBe('Move');
  });
});
