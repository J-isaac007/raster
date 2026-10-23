import { describe, expect, it } from 'vitest';
import { rgba } from '@core/color';
import { RED, setup } from './testing';

describe('Editor palette', () => {
  const BLUE = rgba(0, 0, 255);
  const GREEN = rgba(0, 255, 0);

  it('swaps a palette color in every layer and frame, once per linked cel', () => {
    const { ed, px, drag } = setup(4, 1);
    ed.setPalette([RED, GREEN]);
    drag('pencil', [0, 0], [1, 0]);
    ed.duplicateLinkedFrame();
    ed.addFrame();
    drag('pencil', [3, 0], [3, 0]);
    ed.addLayer();
    drag('pencil', [2, 0], [2, 0]);
    ed.updateLayer(ed.activeLayer.id, { locked: true });

    ed.setPaletteColor(0, BLUE);
    const s = ed.getState();
    expect(s.palette).toEqual([BLUE, GREEN]);
    expect(s.primary).toBe(BLUE);
    expect(s.undoLabel).toBe('Swap Palette Color');
    const [bottom, top] = ed.sprite.layers;
    expect([...bottom.cels[0]]).toEqual([BLUE, BLUE, 0, 0]);
    expect(bottom.cels[1]).toBe(bottom.cels[0]);
    expect([...bottom.cels[2]]).toEqual([0, 0, 0, BLUE]);
    expect(top.cels[2][2]).toBe(BLUE);

    ed.undo();
    expect(ed.getState().palette).toEqual([RED, GREEN]);
    expect(ed.getState().primary).toBe(RED);
    expect([...bottom.cels[0]]).toEqual([RED, RED, 0, 0]);
    expect(px(2, 0)).toBe(RED);
    ed.redo();
    expect(px(2, 0)).toBe(BLUE);
  });

  it('snaps pixels and colors to the palette in indexed mode', () => {
    const { ed, px, drag } = setup(3, 1);
    ed.setPrimary(rgba(250, 10, 10));
    drag('pencil', [0, 0], [0, 0]);
    ed.setPrimary(rgba(10, 10, 240));
    drag('pencil', [1, 0], [1, 0]);
    ed.setPalette([RED, BLUE]);

    ed.setIndexed(true);
    expect(ed.getState().indexed).toBe(true);
    expect([px(0, 0), px(1, 0), px(2, 0)]).toEqual([RED, BLUE, 0]);
    expect(ed.getState().primary).toBe(BLUE);

    ed.setPrimary(rgba(200, 0, 50));
    expect(ed.getState().primary).toBe(RED);
    ed.setPrimary(rgba(255, 0, 0, 128));
    drag('pencil', [2, 0], [2, 0]);
    expect(px(2, 0)).toBe(RED);

    ed.undo();
    ed.undo();
    expect(ed.getState().indexed).toBe(false);
    expect(px(0, 0)).toBe(rgba(250, 10, 10));
  });

  it('carries indexed pixels along with palette changes', () => {
    const { ed, px, drag } = setup(2, 1);
    ed.setPalette([RED, GREEN, BLUE]);
    ed.setIndexed(true);
    drag('pencil', [0, 0], [0, 0]);
    ed.setPrimary(BLUE);
    drag('pencil', [1, 0], [1, 0]);

    ed.setPalette([GREEN, BLUE, RED]);
    expect([px(0, 0), px(1, 0)]).toEqual([GREEN, RED]);
    ed.setPalette([GREEN, BLUE]);
    expect([px(0, 0), px(1, 0)]).toEqual([GREEN, GREEN]);
  });

  it('snaps pasted pixels in indexed mode', () => {
    const { ed, px } = setup(1, 1);
    ed.setPalette([RED, GREEN]);
    ed.setIndexed(true);
    ed.paste({ width: 1, height: 1, pixels: Uint32Array.of(rgba(20, 220, 20)) });
    ed.settle();
    expect(px(0, 0)).toBe(GREEN);
  });
});
