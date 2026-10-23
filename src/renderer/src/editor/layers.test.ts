import { describe, expect, it } from 'vitest';
import { RED, setup } from './testing';

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
