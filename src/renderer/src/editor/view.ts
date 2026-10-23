import type { Surface } from '@core/sprite';
import type { EditorCore } from './core';
import { ZOOM_STEPS, type ReferenceSettings } from './state';

/** Viewport, zoom and pan, tile mode wrapping and the reference image. None of it is undoable. */
export class EditorView {
  /** Screen size of the canvas viewport, in CSS pixels. */
  viewport = { width: 0, height: 0 };
  /** A picture shown over or under the canvas to trace or compare. Not saved. */
  referenceImage: Surface | null = null;

  constructor(private readonly core: EditorCore) {}

  // ---- tiles & reference ----------------------------------------------------

  /** Wraps a point onto the canvas along the axes tile mode repeats on. */
  wrap(x: number, y: number): [number, number] {
    const { tileMode } = this.core.getState();
    const { width: w, height: h } = this.core.sprite;
    if (tileMode === 'x' || tileMode === 'both') x = ((x % w) + w) % w;
    if (tileMode === 'y' || tileMode === 'both') y = ((y % h) + h) % h;
    return [x, y];
  }

  setTileGrid(width: number, height: number): void {
    const clamp = (n: number) => Math.min(1024, Math.max(1, Math.round(n) || 1));
    this.core.set({ tileGrid: { width: clamp(width), height: clamp(height) } });
  }

  setReference(image: Surface | null): void {
    this.referenceImage = image;
    this.core.set({ reference: image ? { opacity: 0.5, above: false, visible: true } : null });
  }

  updateReference(patch: Partial<ReferenceSettings>): void {
    const r = this.core.getState().reference;
    if (r) this.core.set({ reference: { ...r, ...patch } });
  }

  // ---- view -----------------------------------------------------------------

  setViewport(width: number, height: number): void {
    this.viewport = { width, height };
  }

  setCursor(cursor: { x: number; y: number } | null): void {
    const c = this.core.getState().cursor;
    if (c?.x === cursor?.x && c?.y === cursor?.y) return;
    this.core.set({ cursor });
  }

  setPanning(panning: boolean): void {
    if (this.core.getState().panning !== panning) this.core.set({ panning });
  }

  setPan(panX: number, panY: number): void {
    this.core.set({ panX, panY });
  }

  /** Zooms keeping the screen point (sx, sy) fixed. Defaults to viewport center. */
  setZoom(zoom: number, sx = this.viewport.width / 2, sy = this.viewport.height / 2): void {
    const { zoom: old, panX, panY } = this.core.getState();
    const z = Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], zoom));
    if (z === old) return;
    const k = z / old;
    this.core.set({ zoom: z, panX: sx - (sx - panX) * k, panY: sy - (sy - panY) * k });
  }

  zoomStep(dir: 1 | -1, sx?: number, sy?: number): void {
    const z = this.core.getState().zoom;
    const next =
      dir > 0
        ? ZOOM_STEPS.find((s) => s > z + 1e-9)
        : [...ZOOM_STEPS].reverse().find((s) => s < z - 1e-9);
    if (next !== undefined) this.setZoom(next, sx, sy);
  }

  zoomToFit(): void {
    const { width: vw, height: vh } = this.viewport;
    if (!vw || !vh) return;
    const { width, height } = this.core.sprite;
    const fit = Math.min((vw * 0.85) / width, (vh * 0.85) / height);
    const zoom = [...ZOOM_STEPS].reverse().find((s) => s <= fit) ?? ZOOM_STEPS[0];
    this.core.set({
      zoom,
      panX: Math.round((vw - width * zoom) / 2),
      panY: Math.round((vh - height * zoom) / 2),
    });
  }
}
