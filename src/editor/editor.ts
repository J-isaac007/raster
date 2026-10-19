import { DITHER_LEVELS, ditherHit, shadeColor } from '../core/brush';
import { blend, rgba, TRANSPARENT, type Color } from '../core/color';
import { applyPatch, diffPixels, History, type Command } from '../core/history';
import { DEFAULT_PALETTE } from '../core/palette';
import {
  floodRegion,
  getPixel,
  inBounds,
  intersectRect,
  plotBrush,
  rectContains,
  type Rect,
} from '../core/raster';
import {
  cloneLayer,
  composite,
  compositeFrame,
  copyRect,
  createLayer,
  createSprite,
  flipPixels,
  DEFAULT_FRAME_MS,
  mergeInto,
  resizePixels,
  showFrame,
  stamp,
  type Layer,
  type Sprite,
  type Surface,
} from '../core/sprite';

export type ToolId =
  'select' | 'pencil' | 'eraser' | 'shade' | 'fill' | 'line' | 'rect' | 'ellipse' | 'picker';

/** Which axes the canvas repeats on, for drawing seamless tiles. */
export type TileMode = 'off' | 'x' | 'y' | 'both';

export interface ReferenceSettings {
  /** 0..1 */
  opacity: number;
  /** Draw above the art (for tracing) instead of below it. */
  above: boolean;
  visible: boolean;
}

export interface LayerInfo {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

/** Immutable UI state. A new object is created on every change. */
export interface EditorState {
  width: number;
  height: number;
  layers: LayerInfo[];
  activeLayerId: string;
  tool: ToolId;
  primary: Color;
  secondary: Color;
  palette: Color[];
  brushSize: number;
  shapeFilled: boolean;
  fillContiguous: boolean;
  mirrorX: boolean;
  mirrorY: boolean;
  /** Freehand strokes drop L-shaped corners (1px brush only). */
  pixelPerfect: boolean;
  /** Ordered-dither coverage, 1..DITHER_LEVELS. DITHER_LEVELS paints solid. */
  dither: number;
  tileMode: TileMode;
  /** Size of the tile grid in pixels (e.g. 16×16 for a tileset). */
  tileGrid: { width: number; height: number };
  showTileGrid: boolean;
  /** Reference image overlay settings; null when none is loaded. */
  reference: ReferenceSettings | null;
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  panning: boolean;
  cursor: { x: number; y: number } | null;
  /** Selected area in sprite pixels. Drawing tools only touch pixels inside it. */
  selection: Rect | null;
  /** Index of the frame being viewed and edited. */
  frame: number;
  /** Frame durations in ms, one per frame. */
  frames: number[];
  playing: boolean;
  onionSkin: boolean;
  undoLabel?: string;
  redoLabel?: string;
  fileName: string;
  dirty: boolean;
  message: string | null;
  /** Bumps whenever pixel data changes. */
  revision: number;
}

export const ZOOM_STEPS = [0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
export const MAX_BRUSH = 32;

const clampDuration = (ms: number) =>
  Math.min(60000, Math.max(10, Math.round(ms) || DEFAULT_FRAME_MS));

type Listener = () => void;

interface Stroke {
  layer: Layer;
  base: Uint32Array;
  clip: Rect | null;
}

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

const layerInfo = (l: Layer): LayerInfo => ({
  id: l.id,
  name: l.name,
  visible: l.visible,
  locked: l.locked,
  opacity: l.opacity,
});

/**
 * Owns the document, history and UI state. React reads state through
 * `subscribe`/`getState`; the canvas reads `sprite` pixels directly.
 */
export class Editor {
  sprite: Sprite;
  readonly history = new History();
  /** Screen size of the canvas viewport, in CSS pixels. */
  viewport = { width: 0, height: 0 };

  private state: EditorState;
  private listeners = new Set<Listener>();
  private stroke: Stroke | null = null;
  private floating: Floating | null = null;
  /** Pixels from the last copy or cut. */
  clipboard: Surface | null = null;
  /** A picture shown over or under the canvas to trace or compare. Not saved. */
  referenceImage: Surface | null = null;
  private messageTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(sprite: Sprite = createSprite(32, 32)) {
    this.sprite = sprite;
    this.state = {
      width: sprite.width,
      height: sprite.height,
      layers: sprite.layers.map(layerInfo),
      activeLayerId: sprite.layers[sprite.layers.length - 1].id,
      tool: 'pencil',
      primary: rgba(0, 0, 0),
      secondary: TRANSPARENT,
      palette: [...DEFAULT_PALETTE],
      brushSize: 1,
      shapeFilled: false,
      fillContiguous: true,
      mirrorX: false,
      mirrorY: false,
      pixelPerfect: false,
      dither: DITHER_LEVELS,
      tileMode: 'off',
      tileGrid: { width: 16, height: 16 },
      showTileGrid: false,
      reference: null,
      zoom: 8,
      panX: 0,
      panY: 0,
      showGrid: true,
      panning: false,
      cursor: null,
      selection: null,
      frame: 0,
      frames: sprite.frames.map((f) => f.duration),
      playing: false,
      onionSkin: false,
      fileName: 'untitled',
      dirty: false,
      message: null,
      revision: 0,
    };
  }

  // ---- store plumbing -----------------------------------------------------

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = (): EditorState => this.state;

  private set(patch: Partial<EditorState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** Re-syncs derived document state after any change to `sprite`. */
  private commit(patch: Partial<EditorState> = {}, pixelsChanged = true): void {
    const frameCount = this.sprite.frames.length;
    const frame = Math.min(frameCount - 1, Math.max(0, patch.frame ?? this.state.frame));
    showFrame(this.sprite, frame);
    const layers = this.sprite.layers;
    const activeLayerId = layers.some(
      (l) => l.id === (patch.activeLayerId ?? this.state.activeLayerId),
    )
      ? (patch.activeLayerId ?? this.state.activeLayerId)
      : layers[layers.length - 1].id;
    this.set({
      ...patch,
      width: this.sprite.width,
      height: this.sprite.height,
      layers: layers.map(layerInfo),
      activeLayerId,
      frame,
      frames: this.sprite.frames.map((f) => f.duration),
      undoLabel: this.history.undoLabel,
      redoLabel: this.history.redoLabel,
      revision: pixelsChanged ? this.state.revision + 1 : this.state.revision,
    });
  }

  private record(cmd: Command): void {
    this.history.push(cmd);
    this.commit({ dirty: true });
  }

  notify(message: string): void {
    clearTimeout(this.messageTimer);
    this.set({ message });
    this.messageTimer = setTimeout(() => this.set({ message: null }), 2500);
  }

  // ---- document -----------------------------------------------------------

  get activeLayer(): Layer {
    const id = this.state.activeLayerId;
    return this.sprite.layers.find((l) => l.id === id) ?? this.sprite.layers[0];
  }

  /** Replaces the whole document. Clears history. */
  load(
    sprite: Sprite,
    options: { palette?: Color[]; fileName?: string; dirty?: boolean } = {},
  ): void {
    this.stroke = null;
    this.floating = null;
    this.sprite = sprite;
    this.history.clear();
    this.commit({
      selection: null,
      frame: 0,
      playing: false,
      activeLayerId: sprite.layers[sprite.layers.length - 1].id,
      palette: options.palette?.length ? options.palette : this.state.palette,
      fileName: options.fileName ?? 'untitled',
      dirty: options.dirty ?? false,
      cursor: null,
    });
    this.zoomToFit();
  }

  newSprite(width: number, height: number): void {
    this.load(createSprite(width, height));
  }

  markSaved(fileName: string): void {
    this.set({ fileName, dirty: false });
  }

  resizeCanvas(width: number, height: number, anchorX: number, anchorY: number): void {
    const before = { width: this.sprite.width, height: this.sprite.height };
    if (before.width === width && before.height === height) return;
    this.settle();
    const ox = Math.round((width - before.width) * anchorX);
    const oy = Math.round((height - before.height) * anchorY);
    const layers = [...this.sprite.layers];
    const oldCels = layers.map((l) => l.cels);
    const newCels = layers.map((l) =>
      l.cels.map((pixels) => resizePixels({ ...before, pixels }, width, height, ox, oy)),
    );
    const apply = (w: number, h: number, cels: Uint32Array[][]) => {
      this.sprite.width = w;
      this.sprite.height = h;
      layers.forEach((l, i) => Object.assign(l, { width: w, height: h, cels: cels[i] }));
      showFrame(this.sprite, this.state.frame);
    };
    apply(width, height, newCels);
    this.state = { ...this.state, selection: null };
    this.record({
      label: 'Canvas Size',
      undo: () => apply(before.width, before.height, oldCels),
      redo: () => apply(width, height, newCels),
    });
    this.zoomToFit();
  }

  // ---- strokes (used by tools) --------------------------------------------

  private canEdit(layer: Layer): boolean {
    if (!layer.visible) {
      this.notify('Layer is hidden');
      return false;
    }
    if (layer.locked) {
      this.notify('Layer is locked');
      return false;
    }
    return true;
  }

  /**
   * Starts an undoable pixel edit on the active layer, clipped to the
   * selection. False if not editable.
   */
  beginStroke(): boolean {
    this.settle();
    const layer = this.activeLayer;
    if (!this.canEdit(layer)) return false;
    this.stroke = { layer, base: layer.pixels.slice(), clip: this.state.selection };
    return true;
  }

  get stroking(): boolean {
    return this.stroke !== null;
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
    const { mirrorX, mirrorY } = this.state;
    const { width: w, height: h } = this.sprite;
    const put = (px: number, py: number) => {
      [px, py] = this.wrap(px, py);
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
    const { dither } = this.state;
    this.forDab(x, y, this.state.brushSize, (i, px, py) => {
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
    const { palette } = this.state;
    this.forDab(x, y, this.state.brushSize, (i) => {
      s.layer.pixels[i] = shadeColor(s.base[i], palette, dir);
    });
  }

  fill(x: number, y: number, color: Color | null): void {
    const s = this.stroke;
    if (!s) return;
    [x, y] = this.wrap(x, y);
    const region = floodRegion(
      { width: s.layer.width, height: s.layer.height, pixels: s.base },
      x,
      y,
      this.state.fillContiguous,
      s.clip ?? undefined,
    );
    const { dither } = this.state;
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
    this.set({ revision: this.state.revision + 1 });
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
    this.record({
      label,
      frame: this.state.frame,
      undo: () => applyPatch(target, patch, 'before'),
      redo: () => applyPatch(target, patch, 'after'),
    });
  }

  cancelStroke(): void {
    this.resetStroke();
    this.stroke = null;
    this.touch();
  }

  // ---- history --------------------------------------------------------------

  undo(): void {
    if (this.stroke) return;
    this.settle();
    const cmd = this.history.undo();
    if (cmd) {
      this.commit({ dirty: true, frame: cmd.frame });
      this.notify(`Undo ${cmd.label}`);
    }
  }

  redo(): void {
    if (this.stroke) return;
    this.settle();
    const cmd = this.history.redo();
    if (cmd) {
      this.commit({ dirty: true, frame: cmd.frame });
      this.notify(`Redo ${cmd.label}`);
    }
  }

  // ---- colors & tools -------------------------------------------------------

  setTool(tool: ToolId): void {
    if (this.stroke || tool === this.state.tool) return;
    this.settle();
    this.set({ tool });
  }

  setPrimary(primary: Color): void {
    this.set({ primary });
  }

  setSecondary(secondary: Color): void {
    this.set({ secondary });
  }

  swapColors(): void {
    this.set({ primary: this.state.secondary, secondary: this.state.primary });
  }

  setBrushSize(size: number): void {
    this.set({ brushSize: Math.min(MAX_BRUSH, Math.max(1, Math.round(size))) });
  }

  setOption(
    patch: Partial<
      Pick<
        EditorState,
        | 'shapeFilled'
        | 'fillContiguous'
        | 'mirrorX'
        | 'mirrorY'
        | 'showGrid'
        | 'pixelPerfect'
        | 'dither'
        | 'tileMode'
        | 'showTileGrid'
      >
    >,
  ): void {
    this.set(patch);
  }

  /** Picks the visible (flattened) color under (x, y). */
  pickColor(x: number, y: number, target: 'primary' | 'secondary'): void {
    [x, y] = this.wrap(x, y);
    if (!inBounds(this.sprite, x, y)) return;
    let color: Color = TRANSPARENT;
    for (const layer of this.sprite.layers) {
      if (layer.visible) color = blend(color, getPixel(layer, x, y), layer.opacity);
    }
    if (color === this.state[target]) return;
    this.set(target === 'primary' ? { primary: color } : { secondary: color });
  }

  setPalette(palette: Color[]): void {
    this.set({ palette });
  }

  // ---- layers -------------------------------------------------------------

  setActiveLayer(id: string): void {
    this.settle();
    this.set({ activeLayerId: id });
  }

  private layerIndex(id: string): number {
    return this.sprite.layers.findIndex((l) => l.id === id);
  }

  private insertLayer(layer: Layer, index: number, label: string): void {
    this.settle();
    const layers = this.sprite.layers;
    const prevActive = this.state.activeLayerId;
    layers.splice(index, 0, layer);
    this.history.push({
      label,
      undo: () => {
        layers.splice(layers.indexOf(layer), 1);
        this.state = { ...this.state, activeLayerId: prevActive };
      },
      redo: () => {
        layers.splice(index, 0, layer);
        this.state = { ...this.state, activeLayerId: layer.id };
      },
    });
    this.commit({ activeLayerId: layer.id, dirty: true });
  }

  addLayer(): void {
    const n = this.sprite.layers.length + 1;
    const { width, height, frames } = this.sprite;
    const layer = createLayer(width, height, `Layer ${n}`, frames.length);
    this.insertLayer(layer, this.layerIndex(this.state.activeLayerId) + 1, 'New Layer');
  }

  duplicateLayer(id = this.state.activeLayerId): void {
    const i = this.layerIndex(id);
    if (i < 0) return;
    this.insertLayer(cloneLayer(this.sprite.layers[i]), i + 1, 'Duplicate Layer');
  }

  deleteLayer(id = this.state.activeLayerId): void {
    this.settle();
    const layers = this.sprite.layers;
    if (layers.length <= 1) {
      this.notify('A sprite needs at least one layer');
      return;
    }
    const i = this.layerIndex(id);
    if (i < 0) return;
    const [layer] = layers.splice(i, 1);
    const nextActive = layers[Math.min(i, layers.length - 1)].id;
    this.history.push({
      label: 'Delete Layer',
      undo: () => {
        layers.splice(i, 0, layer);
        this.state = { ...this.state, activeLayerId: layer.id };
      },
      redo: () => {
        layers.splice(layers.indexOf(layer), 1);
        this.state = { ...this.state, activeLayerId: nextActive };
      },
    });
    this.commit({ activeLayerId: nextActive, dirty: true });
  }

  /** Moves a layer up (+1, toward the top) or down (-1). */
  moveLayer(id: string, delta: 1 | -1): void {
    this.settle();
    const layers = this.sprite.layers;
    const from = this.layerIndex(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= layers.length) return;
    const swap = () => {
      [layers[from], layers[to]] = [layers[to], layers[from]];
    };
    swap();
    this.record({ label: 'Move Layer', undo: swap, redo: swap });
  }

  mergeDown(id = this.state.activeLayerId): void {
    this.settle();
    const layers = this.sprite.layers;
    const i = this.layerIndex(id);
    if (i <= 0) {
      this.notify('No layer below to merge into');
      return;
    }
    const upper = layers[i];
    const lower = layers[i - 1];
    const lowerBefore = lower.cels.map((c) => c.slice());
    lower.cels.forEach((cel, f) =>
      mergeInto({ ...lower, pixels: cel }, { ...upper, pixels: upper.cels[f] }),
    );
    const lowerAfter = lower.cels.map((c) => c.slice());
    layers.splice(i, 1);
    const restore = (from: Uint32Array[]) => lower.cels.forEach((c, f) => c.set(from[f]));
    this.history.push({
      label: 'Merge Down',
      undo: () => {
        restore(lowerBefore);
        layers.splice(i, 0, upper);
        this.state = { ...this.state, activeLayerId: upper.id };
      },
      redo: () => {
        restore(lowerAfter);
        layers.splice(i, 1);
        this.state = { ...this.state, activeLayerId: lower.id };
      },
    });
    this.commit({ activeLayerId: lower.id, dirty: true });
  }

  /** Changes layer properties. Name and opacity are undoable; visibility and lock are not. */
  updateLayer(
    id: string,
    patch: Partial<Pick<Layer, 'name' | 'visible' | 'locked' | 'opacity'>>,
  ): void {
    const layer = this.sprite.layers.find((l) => l.id === id);
    if (!layer) return;
    this.settle();
    const { visible, locked, ...tracked } = patch;
    if (visible !== undefined) layer.visible = visible;
    if (locked !== undefined) layer.locked = locked;
    const keys = Object.keys(tracked) as (keyof typeof tracked)[];
    if (keys.length === 0) {
      this.commit({ dirty: true }, visible !== undefined);
      return;
    }
    const before = Object.fromEntries(keys.map((k) => [k, layer[k]]));
    const after = { ...tracked };
    Object.assign(layer, after);
    this.record({
      label: tracked.name !== undefined ? 'Rename Layer' : 'Layer Opacity',
      mergeKey: tracked.opacity !== undefined ? `opacity:${id}` : undefined,
      undo: () => Object.assign(layer, before),
      redo: () => Object.assign(layer, after),
    });
  }

  /** Ends an in-progress merge (e.g. when an opacity drag finishes). */
  sealHistory(): void {
    this.history.seal();
  }

  clearLayer(): void {
    if (!this.beginStroke()) return;
    this.activeLayer.pixels.fill(TRANSPARENT);
    this.endStroke('Clear');
  }

  flip(axis: 'horizontal' | 'vertical', scope: 'layer' | 'sprite'): void {
    this.settle();
    if (scope === 'layer' && this.activeLayer.locked) {
      this.notify('Layer is locked');
      return;
    }
    // A layer flip changes the current cel; a sprite flip changes every cel.
    const { width, height } = this.sprite;
    const targets =
      scope === 'layer' ? [this.activeLayer.pixels] : this.sprite.layers.flatMap((l) => l.cels);
    const run = () => targets.forEach((pixels) => flipPixels({ width, height, pixels }, axis));
    run();
    const label = `Flip ${axis === 'horizontal' ? 'Horizontal' : 'Vertical'}`;
    const frame = scope === 'layer' ? this.state.frame : undefined;
    this.record({ label, frame, undo: run, redo: run });
  }

  // ---- selection ------------------------------------------------------------

  private get bounds(): Rect {
    return { x: 0, y: 0, width: this.sprite.width, height: this.sprite.height };
  }

  get hasFloating(): boolean {
    return this.floating !== null;
  }

  /** Sets the selection, clipped to the canvas. Commits floating pixels first. */
  select(rect: Rect | null): void {
    this.settle();
    this.set({ selection: rect && intersectRect(rect, this.bounds) });
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
      this.commit({ selection });
      return;
    }
    this.history.push({
      label: f.label,
      frame: this.state.frame,
      undo: () => applyPatch(target, patch, 'before'),
      redo: () => applyPatch(target, patch, 'after'),
    });
    this.commit({ selection, dirty: true });
  }

  private float(pixels: Surface, x: number, y: number, under: Uint32Array, label: string): void {
    const layer = this.activeLayer;
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
    this.set({
      selection: { x: f.x, y: f.y, width: f.width, height: f.height },
      revision: this.state.revision + 1,
    });
  }

  private clearRect(pixels: Uint32Array, rect: Rect): void {
    const r = intersectRect(rect, this.bounds);
    if (!r) return;
    const w = this.sprite.width;
    for (let y = r.y; y < r.y + r.height; y++) {
      pixels.fill(TRANSPARENT, y * w + r.x, y * w + r.x + r.width);
    }
  }

  /** Lifts the selected pixels off the active layer so they can be moved. */
  liftSelection(): boolean {
    if (this.floating) return true;
    const sel = this.state.selection;
    const layer = this.activeLayer;
    if (!sel || !this.canEdit(layer)) return false;
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
    const sel = this.state.selection;
    if (!sel) {
      this.notify('Nothing selected');
      return null;
    }
    this.clipboard = f
      ? { width: f.width, height: f.height, pixels: f.pixels.slice() }
      : copyRect(this.activeLayer, sel);
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
    const sel = this.state.selection;
    if (!sel) {
      this.clearLayer();
      return;
    }
    if (!this.beginStroke()) return;
    this.clearRect(this.activeLayer.pixels, sel);
    this.endStroke(label);
  }

  cut(): Surface | null {
    if (!this.state.selection) {
      this.notify('Nothing selected');
      return null;
    }
    if (!this.floating && !this.canEdit(this.activeLayer)) return null;
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
      this.notify('Nothing to paste');
      return;
    }
    this.settle();
    const layer = this.activeLayer;
    if (!this.canEdit(layer)) return;
    const sel = this.state.selection;
    const x = sel ? sel.x : Math.floor((this.sprite.width - pixels.width) / 2);
    const y = sel ? sel.y : Math.floor((this.sprite.height - pixels.height) / 2);
    const copy = { width: pixels.width, height: pixels.height, pixels: pixels.pixels.slice() };
    this.float(copy, x, y, layer.pixels.slice(), 'Paste');
  }

  // ---- frames ---------------------------------------------------------------

  get frameCount(): number {
    return this.sprite.frames.length;
  }

  /** Shows another frame (wrapping around). Navigation, so not undoable. */
  setFrame(frame: number): void {
    if (this.stroke) return;
    const n = this.frameCount;
    const f = ((frame % n) + n) % n;
    if (f === this.state.frame) return;
    this.settle();
    this.commit({ frame: f });
  }

  nextFrame(): void {
    this.setFrame(this.state.frame + 1);
  }

  prevFrame(): void {
    this.setFrame(this.state.frame - 1);
  }

  /** Inserts a frame at `index`, with one cel per layer. */
  private insertFrame(index: number, duration: number, cels: Uint32Array[], label: string): void {
    this.settle();
    const { sprite } = this;
    const layers = [...sprite.layers];
    const frame = { duration };
    const prev = this.state.frame;
    const apply = () => {
      sprite.frames.splice(index, 0, frame);
      layers.forEach((l, i) => l.cels.splice(index, 0, cels[i]));
    };
    apply();
    this.history.push({
      label,
      undo: () => {
        sprite.frames.splice(index, 1);
        layers.forEach((l) => l.cels.splice(index, 1));
        this.state = { ...this.state, frame: prev };
      },
      redo: () => {
        apply();
        this.state = { ...this.state, frame: index };
      },
    });
    this.commit({ frame: index, dirty: true });
  }

  addFrame(): void {
    const size = this.sprite.width * this.sprite.height;
    const i = this.state.frame;
    this.insertFrame(
      i + 1,
      this.sprite.frames[i].duration,
      this.sprite.layers.map(() => new Uint32Array(size)),
      'New Frame',
    );
  }

  duplicateFrame(): void {
    const i = this.state.frame;
    this.settle();
    this.insertFrame(
      i + 1,
      this.sprite.frames[i].duration,
      this.sprite.layers.map((l) => l.cels[i].slice()),
      'Duplicate Frame',
    );
  }

  deleteFrame(): void {
    if (this.frameCount <= 1) {
      this.notify('A sprite needs at least one frame');
      return;
    }
    this.settle();
    const { sprite } = this;
    const i = this.state.frame;
    const layers = [...sprite.layers];
    const [frame] = sprite.frames.splice(i, 1);
    const removed = layers.map((l) => l.cels.splice(i, 1)[0]);
    const after = Math.min(i, sprite.frames.length - 1);
    this.history.push({
      label: 'Delete Frame',
      undo: () => {
        sprite.frames.splice(i, 0, frame);
        layers.forEach((l, k) => l.cels.splice(i, 0, removed[k]));
        this.state = { ...this.state, frame: i };
      },
      redo: () => {
        sprite.frames.splice(i, 1);
        layers.forEach((l) => l.cels.splice(i, 1));
        this.state = { ...this.state, frame: after };
      },
    });
    this.commit({ frame: after, dirty: true });
  }

  /** Moves the current frame earlier (-1) or later (+1). */
  moveFrame(delta: 1 | -1): void {
    const from = this.state.frame;
    const to = from + delta;
    if (to < 0 || to >= this.frameCount) return;
    this.settle();
    const { sprite } = this;
    const layers = [...sprite.layers];
    const swap = () => {
      const f = sprite.frames;
      [f[from], f[to]] = [f[to], f[from]];
      for (const l of layers) [l.cels[from], l.cels[to]] = [l.cels[to], l.cels[from]];
    };
    swap();
    this.history.push({
      label: 'Move Frame',
      undo: () => {
        swap();
        this.state = { ...this.state, frame: from };
      },
      redo: () => {
        swap();
        this.state = { ...this.state, frame: to };
      },
    });
    this.commit({ frame: to, dirty: true });
  }

  /** Sets one frame's duration (ms). Repeated edits to a frame merge into one undo step. */
  setFrameDuration(frame: number, ms: number): void {
    const target = this.sprite.frames[frame];
    if (!target) return;
    const duration = clampDuration(ms);
    const before = target.duration;
    if (before === duration) return;
    target.duration = duration;
    this.history.push({
      label: 'Frame Duration',
      mergeKey: `duration:${frame}`,
      undo: () => (target.duration = before),
      redo: () => (target.duration = duration),
    });
    this.commit({ dirty: true }, false);
  }

  /** Gives every frame the same duration. */
  setAllFrameDurations(ms: number): void {
    const duration = clampDuration(ms);
    const frames = [...this.sprite.frames];
    const before = frames.map((f) => f.duration);
    if (before.every((d) => d === duration)) return;
    frames.forEach((f) => (f.duration = duration));
    this.history.push({
      label: 'Frame Duration',
      undo: () => frames.forEach((f, i) => (f.duration = before[i])),
      redo: () => frames.forEach((f) => (f.duration = duration)),
    });
    this.commit({ dirty: true }, false);
  }

  setPlaying(playing: boolean): void {
    const next = playing && this.frameCount > 1 && !this.stroke;
    if (next === this.state.playing) return;
    if (next) this.settle();
    this.set({ playing: next });
  }

  setOnionSkin(onionSkin: boolean): void {
    this.set({ onionSkin });
  }

  /** Flattened image of any frame, for export, previews and onion skins. */
  flattenFrame(frame: number): Uint32Array {
    return compositeFrame(this.sprite, frame);
  }

  // ---- tiles & reference ----------------------------------------------------

  /** Wraps a point onto the canvas along the axes tile mode repeats on. */
  wrap(x: number, y: number): [number, number] {
    const { tileMode } = this.state;
    const { width: w, height: h } = this.sprite;
    if (tileMode === 'x' || tileMode === 'both') x = ((x % w) + w) % w;
    if (tileMode === 'y' || tileMode === 'both') y = ((y % h) + h) % h;
    return [x, y];
  }

  setTileGrid(width: number, height: number): void {
    const clamp = (n: number) => Math.min(1024, Math.max(1, Math.round(n) || 1));
    this.set({ tileGrid: { width: clamp(width), height: clamp(height) } });
  }

  setReference(image: Surface | null): void {
    this.referenceImage = image;
    this.set({ reference: image ? { opacity: 0.5, above: false, visible: true } : null });
  }

  updateReference(patch: Partial<ReferenceSettings>): void {
    const r = this.state.reference;
    if (r) this.set({ reference: { ...r, ...patch } });
  }

  // ---- view -----------------------------------------------------------------

  setViewport(width: number, height: number): void {
    this.viewport = { width, height };
  }

  setCursor(cursor: { x: number; y: number } | null): void {
    const c = this.state.cursor;
    if (c?.x === cursor?.x && c?.y === cursor?.y) return;
    this.set({ cursor });
  }

  setPanning(panning: boolean): void {
    if (this.state.panning !== panning) this.set({ panning });
  }

  setPan(panX: number, panY: number): void {
    this.set({ panX, panY });
  }

  /** Zooms keeping the screen point (sx, sy) fixed. Defaults to viewport center. */
  setZoom(zoom: number, sx = this.viewport.width / 2, sy = this.viewport.height / 2): void {
    const { zoom: old, panX, panY } = this.state;
    const z = Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], zoom));
    if (z === old) return;
    const k = z / old;
    this.set({ zoom: z, panX: sx - (sx - panX) * k, panY: sy - (sy - panY) * k });
  }

  zoomStep(dir: 1 | -1, sx?: number, sy?: number): void {
    const z = this.state.zoom;
    const next =
      dir > 0
        ? ZOOM_STEPS.find((s) => s > z + 1e-9)
        : [...ZOOM_STEPS].reverse().find((s) => s < z - 1e-9);
    if (next !== undefined) this.setZoom(next, sx, sy);
  }

  zoomToFit(): void {
    const { width: vw, height: vh } = this.viewport;
    if (!vw || !vh) return;
    const { width, height } = this.sprite;
    const fit = Math.min((vw * 0.85) / width, (vh * 0.85) / height);
    const zoom = [...ZOOM_STEPS].reverse().find((s) => s <= fit) ?? ZOOM_STEPS[0];
    this.set({
      zoom,
      panX: Math.round((vw - width * zoom) / 2),
      panY: Math.round((vh - height * zoom) / 2),
    });
  }

  /** Flattened image, for export and previews. */
  flatten(): Uint32Array {
    return composite(this.sprite);
  }
}
