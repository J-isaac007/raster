import { describe, expect, it } from 'vitest';
import { rgba } from '@core/color';
import { RED, at, setup } from './testing';
import { TOOL_BY_ID } from './tools';

describe('Editor strokes', () => {
  it('draws a pencil line and undoes it as one step', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [0, 0], [3, 0]);
    expect([0, 1, 2, 3].map((x) => px(x, 0))).toEqual([RED, RED, RED, RED]);
    expect(ed.getState().undoLabel).toBe('Pencil');

    ed.undo();
    expect(px(2, 0)).toBe(0);
    ed.redo();
    expect(px(2, 0)).toBe(RED);
  });

  it('erases', () => {
    const { px, drag } = setup();
    drag('pencil', [0, 0], [3, 0]);
    drag('eraser', [1, 0], [2, 0]);
    expect([0, 1, 2, 3].map((x) => px(x, 0))).toEqual([RED, 0, 0, RED]);
  });

  it('does not stack alpha within one stroke', () => {
    const { ed, px, drag } = setup();
    const half = rgba(255, 0, 0, 128);
    ed.setPrimary(half);
    ed.setBrushSize(3);
    drag('pencil', [3, 3], [4, 3]);
    expect(px(3, 3)).toBe(half);
  });

  it('mirrors strokes', () => {
    const { ed, px, drag } = setup();
    ed.setOption({ mirrorX: true });
    drag('pencil', [1, 2], [1, 2]);
    expect(px(1, 2)).toBe(RED);
    expect(px(6, 2)).toBe(RED);
  });

  it('previews shapes without leaving trails', () => {
    const { ed, px } = setup();
    const rect = TOOL_BY_ID.rect;
    rect.down(ed, at(0, 0));
    rect.move(ed, at(7, 7));
    rect.move(ed, at(2, 2));
    rect.up(ed, at(2, 2));
    expect(px(7, 7)).toBe(0);
    expect(px(2, 2)).toBe(RED);
    expect(px(1, 1)).toBe(0);
  });

  it('flood fills', () => {
    const { ed, px, drag } = setup(4, 4);
    drag('line', [2, 0], [2, 3]);
    ed.setSecondary(rgba(0, 0, 255));
    TOOL_BY_ID.fill.down(ed, at(0, 0, { button: 2 }));
    expect(px(0, 0)).toBe(rgba(0, 0, 255));
    expect(px(3, 0)).toBe(0);
  });

  it('refuses to draw on locked or hidden layers', () => {
    const { ed, px, drag } = setup();
    ed.updateLayer(ed.activeLayer.id, { locked: true });
    drag('pencil', [0, 0], [1, 0]);
    expect(px(0, 0)).toBe(0);
    expect(ed.getState().message).toBe('Layer is locked');
  });

  it('picks the visible color', () => {
    const { ed, drag } = setup();
    drag('pencil', [0, 0], [0, 0]);
    ed.setPrimary(0);
    TOOL_BY_ID.picker.down(ed, at(0, 0));
    expect(ed.getState().primary).toBe(RED);
  });
});
