import { ADJUSTMENT_LABELS, applyAdjustment, type Adjustment } from '@core/adjust';
import { TRANSPARENT, type Color } from '@core/color';
import { intersectRect, selectionContains } from '@core/raster';
import type { Surface } from '@core/sprite';
import type { EditorCore } from './core';
import type { EditorPalette } from './palette';
import type { EditorSelection } from './selection';
import type { EditorStrokes } from './strokes';

/** Floating pixels as they were when the adjustment began. */
interface FloatingSource {
  pixels: Surface;
  mask?: Uint8Array;
  x: number;
  y: number;
  label: string;
}

interface Session {
  kind: Adjustment['kind'];
  /** Set when the selection was floating: the adjustment edits the floating pixels. */
  floating: FloatingSource | null;
  /** Snaps results to the palette in indexed mode. */
  snap: (c: Color) => Color;
}

/** A copy of `src` with the pixels outside `inside(i)` made transparent. */
function masked(src: Surface, inside: (i: number) => boolean): Surface {
  const pixels = src.pixels.slice();
  for (let i = 0; i < pixels.length; i++) if (!inside(i)) pixels[i] = TRANSPARENT;
  return { width: src.width, height: src.height, pixels };
}

/**
 * The Adjust menu: color adjustments and effects on the selection, or the
 * active layer's current cel when nothing is selected. While a dialog is
 * open the result previews on the canvas; applying leaves one undo step,
 * cancelling none.
 *
 * On a cel the adjustment runs as a stroke, re-rendered from the stroke's
 * base on every change. Floating (moved or pasted) pixels are re-rendered
 * from a snapshot instead, and applying settles them as one undo step.
 */
export class EditorAdjust {
  private session: Session | null = null;

  constructor(
    private readonly core: EditorCore,
    private readonly strokes: EditorStrokes,
    private readonly selection: EditorSelection,
    private readonly palette: EditorPalette,
  ) {}

  get active(): boolean {
    return this.session !== null;
  }

  /** Starts previewing an adjustment. False if the layer can't be edited. */
  begin(kind: Adjustment['kind']): boolean {
    if (this.session) return this.session.kind === kind;
    if (this.core.stroking) return false;
    // Finish an open free transform first; its pixels may stay floating.
    this.selection.beforeEdit();
    const snap = this.palette.snapper() ?? ((c: Color) => c);
    if (this.selection.hasFloating) {
      if (!this.core.canEdit(this.core.activeLayer)) return false;
      this.session = { kind, floating: this.selection.floatingSnapshot(), snap };
    } else {
      if (!this.strokes.beginStroke()) return false;
      this.session = { kind, floating: null, snap };
    }
    this.core.set({ adjusting: ADJUSTMENT_LABELS[kind] });
    return true;
  }

  /** Shows `a` on the canvas, or the original pixels when null. */
  preview(a: Adjustment | null): void {
    const s = this.session;
    if (!s) return;
    if (s.floating) this.previewFloating(s, s.floating, a);
    else this.previewCel(s, a);
  }

  /** Renders `a` and commits it as one undo step. */
  apply(a: Adjustment): void {
    const s = this.session;
    if (!s) return;
    this.preview(a);
    this.session = null;
    this.core.set({ adjusting: null });
    const label = ADJUSTMENT_LABELS[s.kind];
    if (!s.floating) {
      this.strokes.endStroke(label);
      return;
    }
    const now = this.selection.floatingSnapshot()!;
    const before = s.floating.pixels.pixels;
    if (now.pixels.pixels.every((c, i) => c === before[i])) {
      // Nothing changed: leave the pixels floating as they were.
      this.restore(s.floating);
      return;
    }
    this.selection.replaceFloating(now.pixels, now.mask, now.x, now.y, label);
    this.selection.settle();
  }

  /** Puts the pixels back as they were. Leaves no undo step. */
  cancel(): void {
    const s = this.session;
    if (!s) return;
    this.session = null;
    if (s.floating) this.restore(s.floating);
    else this.strokes.cancelStroke();
    this.core.set({ adjusting: null });
  }

  /** Drops the session without touching pixels (the document is being replaced). */
  discard(): void {
    this.session = null;
  }

  private restore(f: FloatingSource): void {
    const pixels = { ...f.pixels, pixels: f.pixels.pixels.slice() };
    this.selection.replaceFloating(pixels, f.mask, f.x, f.y, f.label);
  }

  /** Re-renders the stroke from its base, inside the selection. */
  private previewCel(s: Session, a: Adjustment | null): void {
    this.strokes.resetStroke();
    if (a) this.renderCel(s, a);
    this.strokes.touch();
  }

  /** Writes `a`'s result over the stroke's layer, inside the selection, snapped. */
  private renderCel(s: Session, a: Adjustment): void {
    const stroke = this.strokes.strokeBase;
    if (!stroke) return;
    const { layer, base } = stroke;
    const { width: w, height: h } = layer;
    const all = { x: 0, y: 0, width: w, height: h };
    const clip = this.core.getState().selection;
    const r = clip ? intersectRect(clip, all) : all;
    if (!r) return;
    // Effects see only the selected pixels, as if the rest were empty.
    const src = clip
      ? masked({ width: w, height: h, pixels: base }, (i) =>
          selectionContains(clip, i % w, Math.floor(i / w)),
        )
      : { width: w, height: h, pixels: base };
    const out = applyAdjustment(src, a);
    for (let y = r.y; y < r.y + r.height; y++) {
      for (let x = r.x; x < r.x + r.width; x++) {
        if (clip && !selectionContains(clip, x, y)) continue;
        const i = y * w + x;
        if (out[i] !== src.pixels[i]) layer.pixels[i] = s.snap(out[i]);
      }
    }
  }

  /** Re-renders the floating pixels from the snapshot, inside their shape. */
  private previewFloating(s: Session, f: FloatingSource, a: Adjustment | null): void {
    if (!a) {
      this.restore(f);
      return;
    }
    const { mask } = f;
    const src = mask ? masked(f.pixels, (i) => mask[i] === 1) : f.pixels;
    const out = applyAdjustment(src, a);
    const pixels = f.pixels.pixels.slice();
    for (let i = 0; i < pixels.length; i++) {
      if (mask && !mask[i]) continue;
      if (out[i] !== src.pixels[i]) pixels[i] = s.snap(out[i]);
    }
    this.selection.replaceFloating({ ...f.pixels, pixels }, mask, f.x, f.y, f.label);
  }
}
