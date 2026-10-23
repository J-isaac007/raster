import { TRANSPARENT } from '@core/color';
import { cloneLayer, createLayer, flipPixels, mergeInto, type Layer } from '@core/sprite';
import type { EditorCore } from './core';
import type { EditorStrokes } from './strokes';

/** The layer stack: adding, removing, reordering, merging and layer properties. */
export class EditorLayers {
  constructor(
    private readonly core: EditorCore,
    private readonly strokes: EditorStrokes,
  ) {}

  setActiveLayer(id: string): void {
    this.core.settle();
    this.core.set({ activeLayerId: id });
  }

  private layerIndex(id: string): number {
    return this.core.sprite.layers.findIndex((l) => l.id === id);
  }

  private insertLayer(layer: Layer, index: number, label: string): void {
    const { core } = this;
    core.settle();
    const layers = core.sprite.layers;
    const prevActive = core.getState().activeLayerId;
    layers.splice(index, 0, layer);
    core.history.push({
      label,
      undo: () => {
        layers.splice(layers.indexOf(layer), 1);
        core.stage({ activeLayerId: prevActive });
      },
      redo: () => {
        layers.splice(index, 0, layer);
        core.stage({ activeLayerId: layer.id });
      },
    });
    core.commit({ activeLayerId: layer.id, dirty: true });
  }

  addLayer(): void {
    const n = this.core.sprite.layers.length + 1;
    const { width, height, frames } = this.core.sprite;
    const layer = createLayer(width, height, `Layer ${n}`, frames.length);
    this.insertLayer(layer, this.layerIndex(this.core.getState().activeLayerId) + 1, 'New Layer');
  }

  duplicateLayer(id = this.core.getState().activeLayerId): void {
    const i = this.layerIndex(id);
    if (i < 0) return;
    this.insertLayer(cloneLayer(this.core.sprite.layers[i]), i + 1, 'Duplicate Layer');
  }

  deleteLayer(id = this.core.getState().activeLayerId): void {
    const { core } = this;
    core.settle();
    const layers = core.sprite.layers;
    if (layers.length <= 1) {
      core.notify('A sprite needs at least one layer');
      return;
    }
    const i = this.layerIndex(id);
    if (i < 0) return;
    const [layer] = layers.splice(i, 1);
    const nextActive = layers[Math.min(i, layers.length - 1)].id;
    core.history.push({
      label: 'Delete Layer',
      undo: () => {
        layers.splice(i, 0, layer);
        core.stage({ activeLayerId: layer.id });
      },
      redo: () => {
        layers.splice(layers.indexOf(layer), 1);
        core.stage({ activeLayerId: nextActive });
      },
    });
    core.commit({ activeLayerId: nextActive, dirty: true });
  }

  /** Moves a layer up (+1, toward the top) or down (-1). */
  moveLayer(id: string, delta: 1 | -1): void {
    this.core.settle();
    const layers = this.core.sprite.layers;
    const from = this.layerIndex(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= layers.length) return;
    const swap = () => {
      [layers[from], layers[to]] = [layers[to], layers[from]];
    };
    swap();
    this.core.record({ label: 'Move Layer', undo: swap, redo: swap });
  }

  mergeDown(id = this.core.getState().activeLayerId): void {
    const { core } = this;
    core.settle();
    const layers = core.sprite.layers;
    const i = this.layerIndex(id);
    if (i <= 0) {
      core.notify('No layer below to merge into');
      return;
    }
    const upper = layers[i];
    const lower = layers[i - 1];
    // Merged cels are new buffers. Linked frames stay linked unless the upper
    // layer differs between them (empty upper cels count as the same).
    const lowerBefore = lower.cels;
    const merged = new Map<string, Uint32Array>();
    const upperKey = (cel: Uint32Array) =>
      cel.every((c) => c >>> 24 === 0) ? 'empty' : upper.cels.indexOf(cel);
    const lowerAfter = lower.cels.map((cel, f) => {
      const key = `${lower.cels.indexOf(cel)}:${upperKey(upper.cels[f])}`;
      let out = merged.get(key);
      if (!out) {
        out = cel.slice();
        mergeInto({ ...lower, pixels: out }, { ...upper, pixels: upper.cels[f] });
        merged.set(key, out);
      }
      return out;
    });
    lower.cels = lowerAfter;
    layers.splice(i, 1);
    core.history.push({
      label: 'Merge Down',
      undo: () => {
        lower.cels = lowerBefore;
        layers.splice(i, 0, upper);
        core.stage({ activeLayerId: upper.id });
      },
      redo: () => {
        lower.cels = lowerAfter;
        layers.splice(i, 1);
        core.stage({ activeLayerId: lower.id });
      },
    });
    core.commit({ activeLayerId: lower.id, dirty: true });
  }

  /** Changes layer properties. Name and opacity are undoable; visibility and lock are not. */
  updateLayer(
    id: string,
    patch: Partial<Pick<Layer, 'name' | 'visible' | 'locked' | 'opacity'>>,
  ): void {
    const layer = this.core.sprite.layers.find((l) => l.id === id);
    if (!layer) return;
    this.core.settle();
    const { visible, locked, ...tracked } = patch;
    if (visible !== undefined) layer.visible = visible;
    if (locked !== undefined) layer.locked = locked;
    const keys = Object.keys(tracked) as (keyof typeof tracked)[];
    if (keys.length === 0) {
      this.core.commit({ dirty: true }, visible !== undefined);
      return;
    }
    const before = Object.fromEntries(keys.map((k) => [k, layer[k]]));
    const after = { ...tracked };
    Object.assign(layer, after);
    this.core.record({
      label: tracked.name !== undefined ? 'Rename Layer' : 'Layer Opacity',
      mergeKey: tracked.opacity !== undefined ? `opacity:${id}` : undefined,
      undo: () => Object.assign(layer, before),
      redo: () => Object.assign(layer, after),
    });
  }

  clearLayer(): void {
    if (!this.strokes.beginStroke()) return;
    this.core.activeLayer.pixels.fill(TRANSPARENT);
    this.strokes.endStroke('Clear');
  }

  flip(axis: 'horizontal' | 'vertical', scope: 'layer' | 'sprite'): void {
    const { core } = this;
    core.settle();
    if (scope === 'layer' && core.activeLayer.locked) {
      core.notify('Layer is locked');
      return;
    }
    // A layer flip changes the current cel; a sprite flip changes every cel.
    const { width, height } = core.sprite;
    // Linked cels share a buffer: flip each buffer once.
    const targets =
      scope === 'layer'
        ? [core.activeLayer.pixels]
        : [...new Set(core.sprite.layers.flatMap((l) => l.cels))];
    const run = () => targets.forEach((pixels) => flipPixels({ width, height, pixels }, axis));
    run();
    const label = `Flip ${axis === 'horizontal' ? 'Horizontal' : 'Vertical'}`;
    const frame = scope === 'layer' ? core.getState().frame : undefined;
    core.record({ label, frame, undo: run, redo: run });
  }
}
