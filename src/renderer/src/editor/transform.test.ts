import { describe, expect, it } from 'vitest';
import { rgba } from '@core/color';
import { RED, setup } from './testing';

const BLUE = rgba(0, 0, 255);

describe('Editor sprite geometry', () => {
  it('rotates every layer and frame a quarter turn, undoably', () => {
    const { ed, px } = setup(4, 2);
    ed.activeLayer.pixels[0] = RED; // top-left
    ed.addFrame();
    ed.activeLayer.pixels[3] = BLUE; // frame 2, top-right
    ed.rotateSprite(1);
    expect([ed.sprite.width, ed.sprite.height]).toEqual([2, 4]);
    expect(ed.getState().width).toBe(2);
    expect(px(1, 3)).toBe(BLUE);
    expect(ed.activeLayer.cels[0][1]).toBe(RED); // top-left → top-right
    ed.undo();
    expect([ed.sprite.width, ed.sprite.height]).toEqual([4, 2]);
    expect(ed.activeLayer.cels[0][0]).toBe(RED);
  });

  it('keeps linked cels linked when reshaping', () => {
    const { ed } = setup(4, 4);
    ed.duplicateLinkedFrame();
    ed.rotateSprite(-1);
    const [a, b] = ed.activeLayer.cels;
    expect(a).toBe(b);
  });

  it('scales the sprite with nearest neighbor', () => {
    const { ed } = setup(2, 2);
    ed.activeLayer.pixels[0] = RED;
    ed.scaleSprite(4, 4);
    const p = ed.activeLayer.pixels;
    expect([p[0], p[1], p[4], p[5]]).toEqual([RED, RED, RED, RED]);
    expect(p[2]).toBe(0);
    ed.undo();
    expect(ed.sprite.width).toBe(2);
  });

  it('crops to the selection and trims empty edges', () => {
    const { ed, px } = setup(8, 8);
    ed.activeLayer.pixels[3 * 8 + 2] = RED;
    ed.activeLayer.pixels[5 * 8 + 6] = BLUE;
    ed.trim();
    expect([ed.sprite.width, ed.sprite.height]).toEqual([5, 3]);
    expect(px(0, 0)).toBe(RED);
    expect(px(4, 2)).toBe(BLUE);

    ed.select({ x: 3, y: 1, width: 2, height: 2 });
    ed.cropToSelection();
    expect([ed.sprite.width, ed.sprite.height]).toEqual([2, 2]);
    expect(px(1, 1)).toBe(BLUE);
    expect(ed.getState().selection).toBeNull();
  });

  it('says so when there is nothing to trim', () => {
    const { ed } = setup(4, 4);
    ed.trim();
    expect(ed.getState().message).toBe('The sprite is empty');
    expect(ed.sprite.width).toBe(4);
  });
});

describe('Editor selection transforms', () => {
  it('rotates the selection around its center and keeps it floating', () => {
    const { ed, px } = setup(8, 8);
    // A 3×1 bar at (2..4, 4).
    for (let x = 2; x <= 4; x++) ed.activeLayer.pixels[4 * 8 + x] = RED;
    ed.select({ x: 2, y: 4, width: 3, height: 1 });
    ed.rotateSelection(1);
    expect(ed.hasFloating).toBe(true);
    expect(ed.getState().selection).toMatchObject({ x: 3, y: 3, width: 1, height: 3 });
    expect([px(3, 3), px(3, 4), px(3, 5)]).toEqual([RED, RED, RED]);
    expect(px(2, 4)).toBe(0);
    ed.deselect();
    ed.undo();
    expect([px(2, 4), px(3, 4), px(4, 4)]).toEqual([RED, RED, RED]);
    expect(px(3, 3)).toBe(0);
  });

  it('flips the selection only', () => {
    const { ed, px } = setup(8, 8);
    ed.activeLayer.pixels[0] = RED;
    ed.activeLayer.pixels[7] = BLUE;
    ed.select({ x: 0, y: 0, width: 2, height: 1 });
    ed.flipSelection('horizontal');
    expect(px(1, 0)).toBe(RED);
    expect(px(0, 0)).toBe(0);
    expect(px(7, 0)).toBe(BLUE);
  });

  it('flips the whole layer with nothing selected', () => {
    const { ed, px } = setup(4, 4);
    ed.activeLayer.pixels[0] = RED;
    ed.flipSelection('vertical');
    expect(px(0, 3)).toBe(RED);
    expect(ed.getState().selection).toBeNull();
  });

  it('turns the whole layer at once with nothing selected', () => {
    const { ed, px } = setup(4, 4);
    ed.activeLayer.pixels[0] = RED;
    ed.rotateSelection(2);
    expect(px(3, 3)).toBe(RED);
    expect(ed.hasFloating).toBe(false);
    expect(ed.getState().selection).toBeNull();
    expect(ed.getState().undoLabel).toBe('Rotate 180°');
  });

  it('free-rotates into a masked selection without new colors', () => {
    const { ed } = setup(16, 16);
    for (let y = 4; y < 12; y++)
      for (let x = 4; x < 12; x++) ed.activeLayer.pixels[y * 16 + x] = RED;
    ed.select({ x: 4, y: 4, width: 8, height: 8 });
    ed.transformSelection({ angle: 45, scaleX: 1, scaleY: 1 });
    const sel = ed.getState().selection!;
    expect(sel.width).toBe(12);
    expect(sel.mask).toBeDefined();
    const used = new Set([...ed.activeLayer.pixels].filter((c) => c !== 0));
    expect(used).toEqual(new Set([RED]));
  });

  it('scales the selection', () => {
    const { ed } = setup(8, 8);
    ed.activeLayer.pixels[0] = RED;
    ed.select({ x: 0, y: 0, width: 2, height: 2 });
    ed.transformSelection({ angle: 0, scaleX: 2, scaleY: 2 });
    expect(ed.getState().selection).toMatchObject({ width: 4, height: 4 });
  });

  it('refuses on a locked layer', () => {
    const { ed, px } = setup(4, 4);
    ed.activeLayer.pixels[0] = RED;
    ed.updateLayer(ed.activeLayer.id, { locked: true });
    ed.rotateSelection(2);
    expect(px(0, 0)).toBe(RED);
    expect(ed.getState().selection).toBeNull();
  });
});
