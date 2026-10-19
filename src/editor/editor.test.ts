import { describe, expect, it } from 'vitest';
import { rgba } from '../core/color';
import { createSprite } from '../core/sprite';
import { Editor } from './editor';
import { TOOL_BY_ID, type ToolEvent } from './tools';

const RED = rgba(255, 0, 0);
const at = (x: number, y: number, extra: Partial<ToolEvent> = {}): ToolEvent => ({
  x,
  y,
  button: 0,
  shift: false,
  ...extra,
});

function setup(w = 8, h = 8) {
  const ed = new Editor(createSprite(w, h));
  ed.setPrimary(RED);
  const px = (x: number, y: number) => ed.activeLayer.pixels[y * ed.sprite.width + x];
  const drag = (
    tool: keyof typeof TOOL_BY_ID,
    from: [number, number],
    to: [number, number],
    shift = false,
  ) => {
    const t = TOOL_BY_ID[tool];
    t.down(ed, at(...from, { shift }));
    t.move(ed, at(...to, { shift }));
    t.up(ed, at(...to, { shift }));
  };
  return { ed, px, drag };
}

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

describe('Editor layers', () => {
  it('adds, deletes and undoes layer changes', () => {
    const { ed } = setup();
    ed.addLayer();
    expect(ed.getState().layers.map((l) => l.name)).toEqual(['Layer 1', 'Layer 2']);
    expect(ed.getState().activeLayerId).toBe(ed.sprite.layers[1].id);

    ed.deleteLayer();
    expect(ed.sprite.layers).toHaveLength(1);
    ed.undo();
    expect(ed.sprite.layers).toHaveLength(2);
    ed.undo();
    expect(ed.sprite.layers).toHaveLength(1);
  });

  it('never deletes the last layer', () => {
    const { ed } = setup();
    ed.deleteLayer();
    expect(ed.sprite.layers).toHaveLength(1);
  });

  it('merges down and restores on undo', () => {
    const { ed, drag } = setup();
    const bottom = ed.activeLayer;
    ed.addLayer();
    drag('pencil', [5, 5], [5, 5]);
    ed.mergeDown();
    expect(ed.sprite.layers).toHaveLength(1);
    expect(bottom.pixels[5 * 8 + 5]).toBe(RED);
    ed.undo();
    expect(ed.sprite.layers).toHaveLength(2);
    expect(bottom.pixels[5 * 8 + 5]).toBe(0);
  });

  it('collapses an opacity drag into one undo step', () => {
    const { ed } = setup();
    const id = ed.activeLayer.id;
    ed.updateLayer(id, { opacity: 0.8 });
    ed.updateLayer(id, { opacity: 0.5 });
    ed.sealHistory();
    ed.updateLayer(id, { opacity: 0.2 });
    ed.undo();
    expect(ed.activeLayer.opacity).toBe(0.5);
    ed.undo();
    expect(ed.activeLayer.opacity).toBe(1);
  });

  it('resizes the canvas undoably', () => {
    const { ed, drag } = setup(4, 4);
    drag('pencil', [0, 0], [0, 0]);
    ed.resizeCanvas(6, 6, 0.5, 0.5);
    expect(ed.sprite.width).toBe(6);
    expect(ed.activeLayer.pixels[1 * 6 + 1]).toBe(RED);
    ed.undo();
    expect(ed.getState().width).toBe(4);
    expect(ed.activeLayer.pixels[0]).toBe(RED);
  });
});

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

describe('Editor frames', () => {
  it('adds frames with their own pixels and switches between them', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [0, 0], [0, 0]);
    ed.addFrame();
    expect(ed.getState().frame).toBe(1);
    expect(ed.getState().frames).toHaveLength(2);
    expect(px(0, 0)).toBe(0);
    drag('pencil', [1, 1], [1, 1]);
    ed.setFrame(0);
    expect(px(0, 0)).toBe(RED);
    expect(px(1, 1)).toBe(0);
  });

  it('duplicates the current frame', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [2, 2], [2, 2]);
    ed.duplicateFrame();
    expect(px(2, 2)).toBe(RED);
    drag('eraser', [2, 2], [2, 2]);
    ed.setFrame(0);
    expect(px(2, 2)).toBe(RED);
  });

  it('undoes a stroke on the frame it was drawn on', () => {
    const { ed, px, drag } = setup();
    ed.addFrame();
    drag('pencil', [3, 3], [3, 3]);
    ed.setFrame(0);
    ed.undo();
    expect(ed.getState().frame).toBe(1);
    expect(px(3, 3)).toBe(0);
  });

  it('deletes and reorders frames undoably', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [0, 0], [0, 0]);
    ed.addFrame();
    drag('pencil', [7, 7], [7, 7]);
    ed.moveFrame(-1);
    expect(ed.getState().frame).toBe(0);
    expect(px(7, 7)).toBe(RED);
    ed.deleteFrame();
    expect(ed.frameCount).toBe(1);
    expect(px(0, 0)).toBe(RED);
    ed.undo();
    expect(ed.frameCount).toBe(2);
    expect(px(7, 7)).toBe(RED);
    ed.undo();
    ed.setFrame(0);
    expect(px(0, 0)).toBe(RED);
  });

  it('keeps every frame in sync for layer and canvas changes', () => {
    const { ed, drag } = setup(4, 4);
    ed.addFrame();
    ed.addLayer();
    expect(ed.activeLayer.cels).toHaveLength(2);
    drag('pencil', [0, 0], [0, 0]);
    ed.mergeDown();
    expect(ed.sprite.layers[0].cels[1][0]).toBe(RED);
    ed.resizeCanvas(6, 6, 0, 0);
    expect(ed.sprite.layers[0].cels.every((c) => c.length === 36)).toBe(true);
  });

  it('sets durations, merging repeated edits', () => {
    const { ed } = setup();
    ed.setFrameDuration(0, 150);
    ed.setFrameDuration(0, 200);
    expect(ed.getState().frames).toEqual([200]);
    ed.undo();
    expect(ed.getState().frames).toEqual([100]);
  });

  it('only plays with more than one frame', () => {
    const { ed } = setup();
    ed.setPlaying(true);
    expect(ed.getState().playing).toBe(false);
    ed.addFrame();
    ed.setPlaying(true);
    expect(ed.getState().playing).toBe(true);
  });
});

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
