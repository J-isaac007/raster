import { DITHER_LEVELS, ditherHit, shadeColor } from '../core/brush';
import { blend, TRANSPARENT, type Color } from '../core/color';
import { applyPatch, diffPixels } from '../core/history';
import { floodRegion, inBounds, plotBrush, rectContains, type Rect } from '../core/raster';
import type { Layer } from '../core/sprite';
import type { EditorCore } from './core';
import type { EditorView } from './view';

interface Stroke {
  layer: Layer;
  base: Uint32Array;
  clip: Rect | null;
}

/** Undoable pixel edits on the active layer, driven by the drawing tools. */
export class EditorStrokes {
  private stroke: Stroke | null = null;

  constructor(
    private readonly core: EditorCore,
    private readonly view: EditorView,
  ) {}

  /**
   * Starts an undoable pixel edit on the active layer, clipped to the
   * selection. False if not editable.
   */
  beginStroke(): boolean {
    this.core.settle();
    const layer = this.core.activeLayer;
    if (!this.core.canEdit(layer)) return false;
    this.stroke = { layer, base: layer.pixels.slice(), clip: this.core.getState().selection };
    return true;
  }

  get stroking(): boolean {
    return this.stroke !== null;
  }

  /** Drops the stroke without recording it (the document is being replaced). */
  discard(): void {
    this.stroke = null;
  }

  /** Reverts the stroke to its starting pixels (for live shape previews). */
  resetStroke(): void {
    if (this.stroke) this.stroke.layer.pixels.set(this.stroke.base);
  }

  /**
   * Calls `fn` with the layer index of every pixel a brush dab at (x, y)
   * covers: brush size, symmetry, canvas bounds and selection applied.
   */
  private forDab(
    x: number,
    y: number,
    size: number,
    fn: (i: number, x: number, y: number) => void,
  ): void {
    const s = this.stroke;
    if (!s) return;
    const { mirrorX, mirrorY } = this.core.getState();
    const { width: w, height: h } = this.core.sprite;
    const put = (px: number, py: number) => {
      [px, py] = this.view.wrap(px, py);
      if (!inBounds(s.layer, px, py) || (s.clip && !rectContains(s.clip, px, py))) return;
      fn(py * w + px, px, py);
    };
    plotBrush(x, y, size, (px, py) => {
      put(px, py);
      if (mirrorX) put(w - 1 - px, py);
      if (mirrorY) put(px, h - 1 - py);
      if (mirrorX && mirrorY) put(w - 1 - px, h - 1 - py);
    });
  }

  /** Paints a brush dab, honoring brush size, symmetry and dither. `null` erases. */
  dab(x: number, y: number, color: Color | null): void {
    const s = this.stroke;
    if (!s) return;
    const { dither, brushSize } = this.core.getState();
    this.forDab(x, y, brushSize, (i, px, py) => {
      if (color !== null && dither < DITHER_LEVELS && !ditherHit(px, py, dither)) return;
      // Blend against the stroke's base so overlapping dabs don't stack alpha.
      s.layer.pixels[i] = color === null ? TRANSPARENT : blend(s.base[i], color);
    });
  }

  /** Restores a 1px dab to how it was when the stroke began (pixel-perfect mode). */
  undab(x: number, y: number): void {
    const s = this.stroke;
    if (s) this.forDab(x, y, 1, (i) => (s.layer.pixels[i] = s.base[i]));
  }

  /** Lightens (`dir` 1) or darkens (-1) pixels under the brush, once per stroke. */
  shadeDab(x: number, y: number, dir: 1 | -1): void {
    const s = this.stroke;
    if (!s) return;
    const { palette, brushSize } = this.core.getState();
    this.forDab(x, y, brushSize, (i) => {
      s.layer.pixels[i] = shadeColor(s.base[i], palette, dir);
    });
  }

  fill(x: number, y: number, color: Color | null): void {
    const s = this.stroke;
    if (!s) return;
    [x, y] = this.view.wrap(x, y);
    const { fillContiguous, dither } = this.core.getState();
    const region = floodRegion(
      { width: s.layer.width, height: s.layer.height, pixels: s.base },
      x,
      y,
      fillContiguous,
      s.clip ?? undefined,
    );
    const w = s.layer.width;
    const skip = (i: number) =>
      color !== null && dither < DITHER_LEVELS && !ditherHit(i % w, Math.floor(i / w), dither);
    for (const i of region) {
      if (skip(i)) continue;
      s.layer.pixels[i] = color === null ? TRANSPARENT : blend(s.base[i], color);
    }
  }

  /** Call during a stroke so the canvas redraws. */
  touch(): void {
    this.core.set({ revision: this.core.getState().revision + 1 });
  }

  endStroke(label: string): void {
    const s = this.stroke;
    this.stroke = null;
    if (!s) return;
    const patch = diffPixels(s.base, s.layer.pixels);
    if (!patch) {
      this.touch();
      return;
    }
    const target = s.layer.pixels;
    this.core.record({
      label,
      frame: this.core.getState().frame,
      undo: () => applyPatch(target, patch, 'before'),
      redo: () => applyPatch(target, patch, 'after'),
    });
  }

  cancelStroke(): void {
    this.resetStroke();
    this.stroke = null;
    this.touch();
  }
}
