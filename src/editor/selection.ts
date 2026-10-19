import { TRANSPARENT } from '../core/color';
import { applyPatch, diffPixels } from '../core/history';
import { intersectRect, type Rect } from '../core/raster';
import { copyRect, stamp, type Layer, type Surface } from '../core/sprite';
import type { EditorCore } from './core';
import type { EditorLayers } from './layers';
import type { EditorStrokes } from './strokes';

/**
 * Pixels lifted off a layer (by moving a selection or pasting). They are
 * stamped onto the layer for display, and become one undo step on commit.
 */
interface Floating extends Surface {
  layer: Layer;
  /** The cel being edited (the layer's pixels when the float began). */
  target: Uint32Array;
  /** Layer pixels before the lift. */
  base: Uint32Array;
  /** Layer pixels with the lifted area removed. */
  under: Uint32Array;
  x: number;
  y: number;
  label: string;
}

/** The selection rectangle, floating (moved or pasted) pixels and the clipboard. */
export class EditorSelection {
  private floating: Floating | null = null;
  /** Pixels from the last copy or cut. */
  clipboard: Surface | null = null;

  constructor(
    private readonly core: EditorCore,
    private readonly strokes: EditorStrokes,
    private readonly layers: EditorLayers,
  ) {}

  private get bounds(): Rect {
    return { x: 0, y: 0, width: this.core.sprite.width, height: this.core.sprite.height };
  }

  get hasFloating(): boolean {
    return this.floating !== null;
  }

  /** Drops floating pixels without committing them (the document is being replaced). */
  discard(): void {
    this.floating = null;
  }

  /** Sets the selection, clipped to the canvas. Commits floating pixels first. */
  select(rect: Rect | null): void {
    this.settle();
    this.core.set({ selection: rect && intersectRect(rect, this.bounds) });
  }

  selectAll(): void {
    this.select(this.bounds);
  }

  deselect(): void {
    this.select(null);
  }

  /** Commits floating pixels, if any. Runs before anything else edits the document. */
  settle(): void {
    const f = this.floating;
    if (!f) return;
    this.floating = null;
    const { target } = f;
    const selection = intersectRect(
      { x: f.x, y: f.y, width: f.width, height: f.height },
      this.bounds,
    );
    const patch = diffPixels(f.base, target);
    if (!patch) {
      this.core.commit({ selection });
      return;
    }
    this.core.history.push({
      label: f.label,
      frame: this.core.getState().frame,
      undo: () => applyPatch(target, patch, 'before'),
      redo: () => applyPatch(target, patch, 'after'),
    });
    this.core.commit({ selection, dirty: true });
  }

  private float(pixels: Surface, x: number, y: number, under: Uint32Array, label: string): void {
    const layer = this.core.activeLayer;
    this.floating = {
      ...pixels,
      layer,
      target: layer.pixels,
      base: layer.pixels.slice(),
      under,
      x,
      y,
      label,
    };
    this.redrawFloating();
  }

  private redrawFloating(): void {
    const f = this.floating!;
    f.target.set(f.under);
    stamp({ width: f.layer.width, height: f.layer.height, pixels: f.target }, f, f.x, f.y);
    this.core.set({
      selection: { x: f.x, y: f.y, width: f.width, height: f.height },
      revision: this.core.getState().revision + 1,
    });
  }

  private clearRect(pixels: Uint32Array, rect: Rect): void {
    const r = intersectRect(rect, this.bounds);
    if (!r) return;
    const w = this.core.sprite.width;
    for (let y = r.y; y < r.y + r.height; y++) {
      pixels.fill(TRANSPARENT, y * w + r.x, y * w + r.x + r.width);
    }
  }

  /** Lifts the selected pixels off the active layer so they can be moved. */
  liftSelection(): boolean {
    if (this.floating) return true;
    const sel = this.core.getState().selection;
    const layer = this.core.activeLayer;
    if (!sel || !this.core.canEdit(layer)) return false;
    const under = layer.pixels.slice();
    this.clearRect(under, sel);
    this.float(copyRect(layer, sel), sel.x, sel.y, under, 'Move');
    return true;
  }

  /** Moves floating pixels so their top-left corner is at (x, y). */
  moveFloating(x: number, y: number): void {
    const f = this.floating;
    if (!f || (f.x === x && f.y === y)) return;
    f.x = x;
    f.y = y;
    this.redrawFloating();
  }

  /** Copies the selected pixels (floating ones included) to the clipboard. */
  copy(): Surface | null {
    const f = this.floating;
    const sel = this.core.getState().selection;
    if (!sel) {
      this.core.notify('Nothing selected');
      return null;
    }
    this.clipboard = f
      ? { width: f.width, height: f.height, pixels: f.pixels.slice() }
      : copyRect(this.core.activeLayer, sel);
    return this.clipboard;
  }

  /** Clears the selected pixels, or the whole layer if nothing is selected. */
  deleteSelection(label = 'Delete'): void {
    const f = this.floating;
    if (f) {
      f.pixels.fill(TRANSPARENT);
      f.label = label;
      this.redrawFloating();
      this.settle();
      return;
    }
    const sel = this.core.getState().selection;
    if (!sel) {
      this.layers.clearLayer();
      return;
    }
    if (!this.strokes.beginStroke()) return;
    this.clearRect(this.core.activeLayer.pixels, sel);
    this.strokes.endStroke(label);
  }

  cut(): Surface | null {
    if (!this.core.getState().selection) {
      this.core.notify('Nothing selected');
      return null;
    }
    if (!this.floating && !this.core.canEdit(this.core.activeLayer)) return null;
    const pixels = this.copy();
    this.deleteSelection('Cut');
    return pixels;
  }

  /**
   * Pastes pixels (default: the clipboard) as a floating selection, at the
   * current selection's corner or centered on the canvas.
   */
  paste(pixels: Surface | null = this.clipboard): void {
    if (!pixels) {
      this.core.notify('Nothing to paste');
      return;
    }
    this.settle();
    const layer = this.core.activeLayer;
    if (!this.core.canEdit(layer)) return;
    const sel = this.core.getState().selection;
    const { width, height } = this.core.sprite;
    const x = sel ? sel.x : Math.floor((width - pixels.width) / 2);
    const y = sel ? sel.y : Math.floor((height - pixels.height) / 2);
    const copy = { width: pixels.width, height: pixels.height, pixels: pixels.pixels.slice() };
    this.float(copy, x, y, layer.pixels.slice(), 'Paste');
  }
}
