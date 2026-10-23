import { brushOrigin, brushPixelColor, DITHER_LEVELS, ditherHit, shadeColor } from '@core/brush';
import { blend, TRANSPARENT, type Color } from '@core/color';
import { applyPatch, diffPixels } from '@core/history';
import { floodRegion, inBounds, plotBrush, selectionContains, type Selection } from '@core/raster';
import type { Layer } from '@core/sprite';
import type { EditorCore } from './core';
import type { EditorPalette } from './palette';
import type { EditorView } from './view';

interface Stroke {
  layer: Layer;
  base: Uint32Array;
  clip: Selection | null;
  /** Snaps painted colors to the palette in indexed mode. */
  snap: (c: Color) => Color;
}

/** Undoable pixel edits on the active layer, driven by the drawing tools. */
export class EditorStrokes {
  private stroke: Stroke | null = null;

  constructor(
    private readonly core: EditorCore,
    private readonly view: EditorView,
    private readonly palette: EditorPalette,
  ) {}

  /**
   * Starts an undoable pixel edit on the active layer, clipped to the
   * selection. False if not editable.
   */
  beginStroke(): boolean {
    this.core.settle();
    const layer = this.core.activeLayer;
    if (!this.core.canEdit(layer)) return false;
    this.stroke = {
      layer,
      base: layer.pixels.slice(),
      clip: this.core.getState().selection,
      snap: this.palette.snapper() ?? ((c) => c),
    };
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
   * covers: brush shape (square of `size`, or the custom brush), symmetry,
   * canvas bounds and selection applied. For custom brushes `fn` also gets
   * the brush pixel's color.
   */
  private forDab(
    x: number,
    y: number,
    size: number,
    fn: (i: number, x: number, y: number, brushPixel?: Color) => void,
    allowCustom = true,
  ): void {
    const s = this.stroke;
    if (!s) return;
    const { mirrorX, mirrorY, customBrush } = this.core.getState();
    const { width: w, height: h } = this.core.sprite;
    const put = (px: number, py: number, brushPixel?: Color) => {
      [px, py] = this.view.wrap(px, py);
      if (!inBounds(s.layer, px, py) || (s.clip && !selectionContains(s.clip, px, py))) return;
      fn(py * w + px, px, py, brushPixel);
    };
    const visit = (px: number, py: number, brushPixel?: Color) => {
      put(px, py, brushPixel);
      if (mirrorX) put(w - 1 - px, py, brushPixel);
      if (mirrorY) put(px, h - 1 - py, brushPixel);
      if (mirrorX && mirrorY) put(w - 1 - px, h - 1 - py, brushPixel);
    };
    if (customBrush && allowCustom) {
      const [ox, oy] = brushOrigin(customBrush);
      const { width: bw, height: bh, pixels } = customBrush;
      for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
          const c = pixels[by * bw + bx];
          if (c >>> 24 !== 0) visit(x + bx - ox, y + by - oy, c);
        }
      }
      return;
    }
    plotBrush(x, y, size, (px, py) => visit(px, py));
  }

  /**
   * Paints a brush dab, honoring the brush (square or custom), symmetry and
   * dither. `null` erases.
   */
  dab(x: number, y: number, color: Color | null): void {
    const s = this.stroke;
    if (!s) return;
    const { dither, brushSize, brushMode } = this.core.getState();
    this.forDab(x, y, brushSize, (i, px, py, brushPixel) => {
      if (color !== null && dither < DITHER_LEVELS && !ditherHit(px, py, dither)) return;
      if (color === null) {
        s.layer.pixels[i] = TRANSPARENT;
        return;
      }
      const paint =
        brushPixel === undefined ? color : brushPixelColor(brushMode, brushPixel, color);
      // Blend against the stroke's base so overlapping dabs don't stack alpha.
      s.layer.pixels[i] = s.snap(blend(s.base[i], paint));
    });
  }

  /** Restores a 1px dab to how it was when the stroke began (pixel-perfect mode). */
  undab(x: number, y: number): void {
    const s = this.stroke;
    if (s) this.forDab(x, y, 1, (i) => (s.layer.pixels[i] = s.base[i]), false);
  }

  /** Lightens (`dir` 1) or darkens (-1) pixels under the brush, once per stroke. */
  shadeDab(x: number, y: number, dir: 1 | -1): void {
    const s = this.stroke;
    if (!s) return;
    const { palette, brushSize } = this.core.getState();
    this.forDab(x, y, brushSize, (i) => {
      s.layer.pixels[i] = s.snap(shadeColor(s.base[i], palette, dir));
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
      s.layer.pixels[i] = color === null ? TRANSPARENT : s.snap(blend(s.base[i], color));
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
