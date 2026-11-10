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

describe('Editor free transform (handles)', () => {
  /** A 2×2 red square at (2, 2) on an 8×8 sprite, selected. */
  const square = () => {
    const t = setup(8, 8);
    for (const [x, y] of [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ])
      t.ed.activeLayer.pixels[y * 8 + x] = RED;
    t.ed.select({ x: 2, y: 2, width: 2, height: 2 });
    return t;
  };

  it('scales the selection live and applies as one undo step', () => {
    const { ed, px } = square();
    expect(ed.beginTransform()).toBe(true);
    expect(ed.getState().transform?.box).toMatchObject({ cx: 3, cy: 3, width: 2, height: 2 });
    ed.setTransform({ scaleX: 2, scaleY: 2 }, 'fast');
    expect(ed.getState().selection).toMatchObject({ x: 1, y: 1, width: 4, height: 4 });
    expect(ed.getState().transform?.box).toMatchObject({ width: 4, height: 4 });
    expect(px(1, 1)).toBe(RED);
    ed.applyTransform();
    expect(ed.transforming).toBe(false);
    expect(ed.getState().transform).toBeNull();
    expect(ed.hasFloating).toBe(true); // still movable, like the dialog was
    ed.deselect();
    expect(ed.getState().undoLabel).toBe('Transform');
    ed.undo();
    expect(px(1, 1)).toBe(0);
    expect(px(2, 2)).toBe(RED);
  });

  it('moves the result by its center', () => {
    const { ed, px } = square();
    ed.beginTransform();
    ed.setTransform({ cx: 6, cy: 6 });
    expect(ed.getState().selection).toMatchObject({ x: 5, y: 5 });
    expect(px(5, 5)).toBe(RED);
    expect(px(2, 2)).toBe(0);
  });

  it('cancels back to the original pixels without an undo step', () => {
    const { ed, px } = square();
    ed.beginTransform();
    ed.setTransform({ angle: 45, scaleX: 3, scaleY: 3 });
    ed.cancelTransform();
    expect(ed.transforming).toBe(false);
    expect(px(2, 2)).toBe(RED);
    expect(px(1, 1)).toBe(0);
    expect(ed.hasFloating).toBe(false);
    expect(ed.getState().selection).toMatchObject({ x: 2, y: 2, width: 2, height: 2 });
    expect(ed.getState().undoLabel).toBeUndefined();
  });

  it('treats undo during a transform as cancel', () => {
    const { ed, px } = square();
    ed.beginTransform();
    ed.setTransform({ scaleX: 2, scaleY: 2 });
    ed.undo();
    expect(ed.transforming).toBe(false);
    expect(px(1, 1)).toBe(0);
    expect(px(2, 2)).toBe(RED);
  });

  it('renders RotSprite on apply after fast previews', () => {
    const make = () => {
      const t = setup(16, 16);
      for (let y = 4; y < 12; y++)
        for (let x = 4; x < 10; x++)
          t.ed.activeLayer.pixels[y * 16 + x] = x === 4 ? 0xff00ff00 : RED;
      t.ed.select({ x: 4, y: 4, width: 6, height: 8 });
      return t.ed;
    };
    const dialog = make();
    dialog.transformSelection({ angle: 30, scaleX: 1, scaleY: 1 });
    const handles = make();
    handles.beginTransform();
    handles.setTransform({ angle: 30 }, 'fast');
    handles.applyTransform();
    expect(handles.activeLayer.pixels).toEqual(dialog.activeLayer.pixels);
  });

  it('transforms the layer content with nothing selected, committing at once', () => {
    const { ed, px } = setup(8, 8);
    ed.activeLayer.pixels[2 * 8 + 1] = RED;
    ed.activeLayer.pixels[2 * 8 + 2] = RED;
    ed.beginTransform();
    // The box hugs the content, not the whole canvas.
    expect(ed.getState().transform?.box).toMatchObject({ width: 2, height: 1 });
    ed.setTransform({ angle: 90 });
    ed.applyTransform();
    expect(ed.hasFloating).toBe(false);
    expect(ed.getState().selection).toBeNull();
    expect(ed.getState().undoLabel).toBe('Transform');
    expect([px(1, 2), px(2, 2)].filter((c) => c === RED)).toHaveLength(1);
    ed.undo();
    expect([px(1, 2), px(2, 2)]).toEqual([RED, RED]);
  });

  it('says so when the layer is empty', () => {
    const { ed } = setup(4, 4);
    expect(ed.beginTransform()).toBe(false);
    expect(ed.getState().message).toBe('The layer is empty');
    expect(ed.getState().selection).toBeNull();
  });

  it('applies before other edits, such as switching tools or deleting', () => {
    const { ed, px } = square();
    ed.beginTransform();
    ed.setTransform({ scaleX: 2, scaleY: 2 }, 'fast');
    expect(ed.getState().tool).toBe('select'); // begin picks the tool that can move the result
    ed.setTool('pencil');
    expect(ed.transforming).toBe(false);
    expect(px(1, 1)).toBe(RED);

    const t = square();
    t.ed.beginTransform();
    t.ed.setTransform({ scaleX: 2, scaleY: 2 });
    t.ed.deleteSelection();
    expect(t.ed.transforming).toBe(false);
    expect(t.px(1, 1)).toBe(0);
    expect(t.px(2, 2)).toBe(0);
  });

  it('clamps scales and folds angles', () => {
    const { ed } = square();
    ed.beginTransform();
    ed.setTransform({ scaleX: 0, scaleY: 50, angle: 270 });
    const t = ed.getState().transform!;
    expect([t.scaleX, t.scaleY, t.angle]).toEqual([0.01, 10, -90]);
  });
});
