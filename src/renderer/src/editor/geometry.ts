import { mapCels, resizePixels, showFrame, uniqueCels, type Surface } from '@core/sprite';
import { contentBounds, rotateQuarter, scaleNearest } from '@core/transform';
import type { EditorCore } from './core';
import type { EditorView } from './view';

/**
 * Changes that reshape the whole sprite (every layer, every frame): canvas
 * size, scaling, quarter turns, cropping and trimming. Each is one undo step.
 */
export class EditorGeometry {
  constructor(
    private readonly core: EditorCore,
    private readonly view: EditorView,
  ) {}

  /** Replaces every cel with `fn(cel)` at the new size, undoably. Clears the selection. */
  private reshape(
    label: string,
    width: number,
    height: number,
    fn: (cel: Surface) => Uint32Array,
  ): void {
    const { core } = this;
    core.settle();
    const sprite = core.sprite;
    const before = { width: sprite.width, height: sprite.height };
    const layers = [...sprite.layers];
    const oldCels = layers.map((l) => l.cels);
    // Linked cels share a buffer: mapCels transforms each once and keeps the links.
    const newCels = layers.map((l) => mapCels(l.cels, (pixels) => fn({ ...before, pixels })));
    const apply = (w: number, h: number, cels: Uint32Array[][]) => {
      sprite.width = w;
      sprite.height = h;
      layers.forEach((l, i) => Object.assign(l, { width: w, height: h, cels: cels[i] }));
      showFrame(sprite, core.getState().frame);
    };
    apply(width, height, newCels);
    core.stage({ selection: null });
    core.record({
      label,
      undo: () => apply(before.width, before.height, oldCels),
      redo: () => apply(width, height, newCels),
    });
    this.view.zoomToFit();
  }

  resizeCanvas(width: number, height: number, anchorX: number, anchorY: number): void {
    const { width: w, height: h } = this.core.sprite;
    if (w === width && h === height) return;
    const ox = Math.round((width - w) * anchorX);
    const oy = Math.round((height - h) * anchorY);
    this.reshape('Canvas Size', width, height, (cel) => resizePixels(cel, width, height, ox, oy));
  }

  /** Scales the sprite to `width` × `height` with nearest-neighbor sampling. */
  scaleSprite(width: number, height: number): void {
    const { width: w, height: h } = this.core.sprite;
    if (w === width && h === height) return;
    this.reshape('Sprite Size', width, height, (cel) => scaleNearest(cel, width, height).pixels);
  }

  /** Turns the sprite clockwise by `turns` quarter turns (-1 is counterclockwise). */
  rotateSprite(turns: 1 | 2 | -1): void {
    const { width: w, height: h } = this.core.sprite;
    const swap = turns !== 2;
    const label = turns === 2 ? 'Rotate 180°' : turns === 1 ? 'Rotate 90° CW' : 'Rotate 90° CCW';
    this.reshape(label, swap ? h : w, swap ? w : h, (cel) => rotateQuarter(cel, turns).pixels);
  }

  /** Crops the canvas to the selection's bounding rectangle. */
  cropToSelection(): void {
    this.core.settle();
    const sel = this.core.getState().selection;
    if (!sel) {
      this.core.notify('Select an area to crop to');
      return;
    }
    const { x, y, width, height } = sel;
    this.reshape('Crop', width, height, (cel) => resizePixels(cel, width, height, -x, -y));
  }

  /** Crops away transparent edges, looking at every layer and frame. */
  trim(): void {
    this.core.settle();
    const sprite = this.core.sprite;
    const bounds = contentBounds(sprite.width, sprite.height, uniqueCels(sprite));
    if (!bounds) {
      this.core.notify('The sprite is empty');
      return;
    }
    const { x, y, width, height } = bounds;
    if (width === sprite.width && height === sprite.height) {
      this.core.notify('Nothing to trim');
      return;
    }
    this.reshape('Trim', width, height, (cel) => resizePixels(cel, width, height, -x, -y));
  }
}
