import type { Surface } from '@core/sprite';
import {
  contentBounds,
  scaledLength,
  transformSurface,
  type TransformQuality,
} from '@core/transform';
import { normalizeAngle } from '@core/transformBox';
import type { EditorCore } from './core';
import type { EditorSelection } from './selection';
import type { FreeTransformInfo } from './state';

/** What a free transform can change. */
export interface FreeTransformParams {
  /** Clockwise, in degrees. */
  angle: number;
  /** 1 = unchanged. */
  scaleX: number;
  scaleY: number;
  /** Where the center of the result goes, in sprite pixels. */
  cx: number;
  cy: number;
}

export const MIN_TRANSFORM_SCALE = 0.01;
export const MAX_TRANSFORM_SCALE = 10;

interface Session {
  /** The floating pixels as they were when the transform began. */
  source: Surface;
  /** Their shape, as 0/1 values for transforming alongside the pixels. */
  shape: Surface;
  hadMask: boolean;
  x: number;
  y: number;
  label: string;
  /** Nothing was selected: the layer's content is transformed and committed at once. */
  whole: boolean;
  /** The pixels were already floating (moved or pasted) before the transform began. */
  wasFloating: boolean;
  params: FreeTransformParams;
  quality: TransformQuality;
}

/**
 * Scaling and rotating with handles on the canvas (Edit › Transform). The
 * selected pixels float while the transform is open; every change re-renders
 * them from the originals, so dragging back and forth loses nothing. Applying
 * leaves one undo step, cancelling none.
 */
export class EditorFreeTransform {
  private session: Session | null = null;

  constructor(
    private readonly core: EditorCore,
    private readonly selection: EditorSelection,
  ) {}

  get active(): boolean {
    return this.session !== null;
  }

  /**
   * Starts transforming the selection, or the active layer's content with
   * nothing selected. Returns false if there's nothing to transform.
   */
  begin(): boolean {
    if (this.session) return true;
    const { core, selection } = this;
    if (core.stroking) return false;
    const whole = !core.getState().selection;
    const wasFloating = selection.hasFloating;
    if (whole) {
      const layer = core.activeLayer;
      const bounds = contentBounds(layer.width, layer.height, [layer.pixels]);
      if (!bounds) {
        core.notify('The layer is empty');
        return false;
      }
      core.stage({ selection: bounds });
    }
    if (!selection.liftSelection()) {
      if (whole) core.set({ selection: null });
      return false;
    }
    const f = selection.floatingSnapshot()!;
    const { width, height } = f.pixels;
    const mask = f.mask ?? new Uint8Array(width * height).fill(1);
    this.session = {
      source: f.pixels,
      shape: { width, height, pixels: Uint32Array.from(mask) },
      hadMask: f.mask !== undefined,
      x: f.x,
      y: f.y,
      label: f.label,
      whole,
      wasFloating,
      params: { angle: 0, scaleX: 1, scaleY: 1, cx: f.x + width / 2, cy: f.y + height / 2 },
      quality: 'best',
    };
    this.publish(f.x, f.y, width, height);
    return true;
  }

  /**
   * Changes the transform and re-renders the preview: `fast` (nearest
   * neighbor) while a handle is dragged, `best` (RotSprite) otherwise.
   */
  set(patch: Partial<FreeTransformParams>, quality: TransformQuality = 'best'): void {
    const s = this.session;
    if (!s) return;
    const p = { ...s.params, ...patch };
    const clamp = (n: number) =>
      Math.min(MAX_TRANSFORM_SCALE, Math.max(MIN_TRANSFORM_SCALE, Number.isFinite(n) ? n : 1));
    p.scaleX = clamp(p.scaleX);
    p.scaleY = clamp(p.scaleY);
    p.angle = Number.isFinite(p.angle) ? normalizeAngle(p.angle) : 0;
    s.params = p;
    s.quality = quality;
    this.render();
  }

  /** Commits the transform: one undo step, labeled Transform. A selection stays floating. */
  apply(): void {
    const s = this.session;
    if (!s) return;
    const { angle, scaleX, scaleY, cx, cy } = s.params;
    const center = { x: s.x + s.source.width / 2, y: s.y + s.source.height / 2 };
    if (angle === 0 && scaleX === 1 && scaleY === 1 && cx === center.x && cy === center.y) {
      this.cancel();
      return;
    }
    if (s.quality !== 'best') {
      s.quality = 'best';
      this.render();
    }
    this.end(s, 'Transform', false);
  }

  /** Puts the pixels back as they were. Leaves no undo step. */
  cancel(): void {
    const s = this.session;
    if (!s) return;
    const mask = s.hadMask ? Uint8Array.from(s.shape.pixels) : undefined;
    this.selection.replaceFloating(s.source, mask, s.x, s.y, s.label);
    // Lifted only for the transform: drop the float again, which leaves no undo step.
    this.end(s, s.label, !s.wasFloating);
  }

  /** Drops the transform without touching pixels (the document is being replaced). */
  discard(): void {
    this.session = null;
  }

  /**
   * Closes the session. A selection stays floating unless `settle`; the whole
   * layer always settles, since nothing was selected to begin with.
   */
  private end(s: Session, label: string, settle: boolean): void {
    const snap = this.selection.floatingSnapshot();
    if (snap && snap.label !== label) {
      this.selection.replaceFloating(snap.pixels, snap.mask, snap.x, snap.y, label);
    }
    this.session = null;
    this.core.set({ transform: null });
    if (settle || s.whole) this.selection.settle();
    if (s.whole) this.core.set({ selection: null });
  }

  private render(): void {
    const s = this.session!;
    const { angle, scaleX, scaleY, cx, cy } = s.params;
    const t = { angle, scaleX, scaleY };
    const out = transformSurface(s.source, t, s.quality);
    const shape = transformSurface(s.shape, t, s.quality).pixels;
    const mask = shape.every((v) => v === 1) ? undefined : Uint8Array.from(shape);
    const x = Math.round(cx - out.width / 2);
    const y = Math.round(cy - out.height / 2);
    this.selection.replaceFloating(out, mask, x, y, s.label);
    this.publish(x, y, out.width, out.height);
  }

  private publish(x: number, y: number, width: number, height: number): void {
    const s = this.session!;
    const { angle, scaleX, scaleY } = s.params;
    const sourceWidth = s.source.width;
    const sourceHeight = s.source.height;
    const info: FreeTransformInfo = {
      angle,
      scaleX,
      scaleY,
      sourceWidth,
      sourceHeight,
      // Centered on the rendered pixels, so the box sits on whole pixels at 0°.
      box: {
        cx: x + width / 2,
        cy: y + height / 2,
        width: scaledLength(sourceWidth, scaleX),
        height: scaledLength(sourceHeight, scaleY),
        angle,
      },
    };
    this.core.set({ transform: info });
  }
}
