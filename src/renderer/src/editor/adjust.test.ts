import { describe, expect, it } from 'vitest';
import type { Adjustment } from '@core/adjust';
import { rgba } from '@core/color';
import { RED, setup } from './testing';

const BLUE = rgba(0, 0, 255);
const GREEN = rgba(0, 255, 0);
const BLACK = rgba(0, 0, 0);
const CYAN = rgba(0, 255, 255);
const hue120: Adjustment = { kind: 'hueSaturation', hue: 120, saturation: 0, lightness: 0 };

/** A 4×1 sprite with red in its first two pixels. */
function redPair() {
  const t = setup(4, 1);
  t.drag('pencil', [0, 0], [1, 0]);
  return t;
}

const row = (ed: ReturnType<typeof setup>['ed']) => [...ed.activeLayer.pixels];

describe('Editor adjust', () => {
  it('previews on the canvas and applies as one undo step', () => {
    const { ed } = redPair();
    expect(ed.beginAdjust('hueSaturation')).toBe(true);
    expect(ed.getState().adjusting).toBe('Hue/Saturation');
    ed.previewAdjust(hue120);
    expect(row(ed)).toEqual([GREEN, GREEN, 0, 0]);
    ed.previewAdjust({ ...hue120, hue: -120 });
    expect(row(ed)).toEqual([BLUE, BLUE, 0, 0]);
    ed.previewAdjust(null);
    expect(row(ed)).toEqual([RED, RED, 0, 0]);
    expect(ed.getState().undoLabel).toBe('Pencil');

    ed.applyAdjust(hue120);
    expect(ed.adjusting).toBe(false);
    expect(ed.getState().adjusting).toBeNull();
    expect(row(ed)).toEqual([GREEN, GREEN, 0, 0]);
    expect(ed.getState().undoLabel).toBe('Hue/Saturation');
    ed.undo();
    expect(row(ed)).toEqual([RED, RED, 0, 0]);
    expect(ed.getState().undoLabel).toBe('Pencil');
    ed.redo();
    expect(row(ed)).toEqual([GREEN, GREEN, 0, 0]);
  });

  it('leaves no undo step when cancelled', () => {
    const { ed } = redPair();
    ed.beginAdjust('replaceColor');
    ed.previewAdjust({ kind: 'replaceColor', from: RED, to: BLUE, tolerance: 0 });
    expect(row(ed)).toEqual([BLUE, BLUE, 0, 0]);
    ed.cancelAdjust();
    expect(row(ed)).toEqual([RED, RED, 0, 0]);
    expect(ed.getState().undoLabel).toBe('Pencil');
    expect(ed.getState().redoLabel).toBeUndefined();
    expect(ed.adjusting).toBe(false);
  });

  it('applies Invert and Desaturate at once', () => {
    const { ed } = redPair();
    ed.adjust({ kind: 'invert' });
    expect(row(ed)).toEqual([CYAN, CYAN, 0, 0]);
    expect(ed.getState().undoLabel).toBe('Invert');
    ed.adjust({ kind: 'desaturate' });
    expect(row(ed)).toEqual([rgba(201, 201, 201), rgba(201, 201, 201), 0, 0]);
    expect(ed.getState().undoLabel).toBe('Desaturate');
    expect(ed.adjusting).toBe(false);
  });

  it('records nothing when the adjustment changes nothing', () => {
    const { ed } = redPair();
    ed.adjust({ kind: 'replaceColor', from: BLUE, to: GREEN, tolerance: 0 });
    expect(ed.getState().undoLabel).toBe('Pencil');
  });

  it('clips to the selection, and effects see only the selected pixels', () => {
    const { ed, px, drag } = setup(6, 1);
    // Art at 1 and 4; only 3..5 is selected.
    drag('pencil', [1, 0], [1, 0]);
    drag('pencil', [4, 0], [4, 0]);
    ed.select({ x: 3, y: 0, width: 3, height: 1 });
    ed.adjust({ kind: 'invert' });
    expect([px(1, 0), px(4, 0)]).toEqual([RED, CYAN]);
    ed.undo();

    ed.beginAdjust('outline');
    ed.previewAdjust({ kind: 'outline', color: BLACK, place: 'outside', diagonals: false });
    // 2 would be outlined by the pixel at 1, but that one isn't selected.
    expect([0, 1, 2, 3, 4, 5].map((x) => px(x, 0))).toEqual([0, RED, 0, BLACK, RED, BLACK]);
    ed.applyAdjust({ kind: 'outline', color: BLACK, place: 'outside', diagonals: false });
    expect(ed.getState().undoLabel).toBe('Outline');
    expect(ed.getState().selection).toEqual({ x: 3, y: 0, width: 3, height: 1 });
  });

  it('paints a drop shadow only on transparent pixels inside the selection', () => {
    const { ed, px } = redPair();
    ed.select({ x: 0, y: 0, width: 3, height: 1 });
    ed.adjust({ kind: 'dropShadow', color: BLACK, dx: 2, dy: 0 });
    expect([0, 1, 2, 3].map((x) => px(x, 0))).toEqual([RED, RED, BLACK, 0]);
  });

  it('adjusts floating pixels and settles them as one undo step', () => {
    const { ed, px } = redPair();
    ed.select({ x: 0, y: 0, width: 2, height: 1 });
    ed.liftSelection();
    ed.moveFloating(2, 0);
    expect(ed.hasFloating).toBe(true);
    expect(ed.getState().undoLabel).toBe('Pencil');

    ed.beginAdjust('hueSaturation');
    ed.previewAdjust(hue120);
    expect(row(ed)).toEqual([0, 0, GREEN, GREEN]);
    ed.applyAdjust(hue120);
    expect(ed.hasFloating).toBe(false);
    expect(ed.getState().undoLabel).toBe('Hue/Saturation');
    expect(ed.getState().selection).toEqual({ x: 2, y: 0, width: 2, height: 1 });

    // The move and the adjustment undo together.
    ed.undo();
    expect([px(0, 0), px(1, 0), px(2, 0)]).toEqual([RED, RED, 0]);
    expect(ed.getState().undoLabel).toBe('Pencil');
  });

  it('cancelling on floating pixels keeps them floating as they were', () => {
    const { ed } = redPair();
    ed.select({ x: 0, y: 0, width: 2, height: 1 });
    ed.liftSelection();
    ed.moveFloating(1, 0);
    ed.beginAdjust('invert');
    ed.previewAdjust({ kind: 'invert' });
    expect(row(ed)).toEqual([0, CYAN, CYAN, 0]);
    ed.cancelAdjust();
    expect(row(ed)).toEqual([0, RED, RED, 0]);
    expect(ed.hasFloating).toBe(true);
    ed.deselect();
    expect(ed.getState().undoLabel).toBe('Move');
  });

  it('snaps results to the palette in indexed mode', () => {
    const { ed } = redPair();
    const DARK_GREEN = rgba(0, 120, 0);
    ed.setPalette([RED, DARK_GREEN, BLUE]);
    ed.setIndexed(true);
    ed.beginAdjust('hueSaturation');
    ed.previewAdjust(hue120);
    // Pure green isn't in the palette; the preview is snapped too.
    expect(row(ed)).toEqual([DARK_GREEN, DARK_GREEN, 0, 0]);
    ed.applyAdjust(hue120);
    expect(row(ed)).toEqual([DARK_GREEN, DARK_GREEN, 0, 0]);

    ed.adjust({ kind: 'outline', color: rgba(10, 10, 250), place: 'outside', diagonals: false });
    expect(row(ed)).toEqual([DARK_GREEN, DARK_GREEN, BLUE, 0]);
  });

  it('backs out of the preview on undo, and redo cancels it first', () => {
    const { ed } = redPair();
    ed.beginAdjust('invert');
    ed.previewAdjust({ kind: 'invert' });
    ed.undo();
    expect(ed.adjusting).toBe(false);
    expect(row(ed)).toEqual([RED, RED, 0, 0]);
    expect(ed.getState().undoLabel).toBe('Pencil');

    ed.undo();
    expect(row(ed)).toEqual([0, 0, 0, 0]);
    ed.beginAdjust('invert');
    ed.previewAdjust({ kind: 'invert' });
    ed.redo();
    expect(ed.adjusting).toBe(false);
    expect(row(ed)).toEqual([RED, RED, 0, 0]);
    expect(ed.getState().undoLabel).toBe('Pencil');
  });

  it('backs out of a floating preview on undo without committing it', () => {
    const { ed } = redPair();
    ed.select({ x: 0, y: 0, width: 2, height: 1 });
    ed.liftSelection();
    ed.moveFloating(2, 0);
    ed.beginAdjust('invert');
    ed.previewAdjust({ kind: 'invert' });
    ed.undo();
    expect(ed.hasFloating).toBe(true);
    expect(row(ed)).toEqual([0, 0, RED, RED]);
    ed.undo();
    expect(row(ed)).toEqual([RED, RED, 0, 0]);
  });

  it('blocks other edits while previewing', () => {
    const { ed } = redPair();
    ed.beginAdjust('invert');
    ed.previewAdjust({ kind: 'invert' });
    ed.setPalette([BLUE]);
    expect(ed.getState().palette).not.toEqual([BLUE]);
    ed.cancelAdjust();
    expect(row(ed)).toEqual([RED, RED, 0, 0]);
  });

  it("won't start on a locked layer", () => {
    const { ed } = redPair();
    ed.updateLayer(ed.activeLayer.id, { locked: true });
    expect(ed.beginAdjust('invert')).toBe(false);
    expect(ed.adjusting).toBe(false);
  });
});
