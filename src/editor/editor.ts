import { makeCustomBrush } from '../core/brush';
import { blend, TRANSPARENT, type Color } from '../core/color';
import { History, type Command } from '../core/history';
import type { SelectMode } from '../core/mask';
import { getPixel, inBounds, type Selection } from '../core/raster';
import {
  composite,
  createSprite,
  mapCels,
  resizePixels,
  showFrame,
  type Layer,
  type Sprite,
  type Surface,
} from '../core/sprite';
import type { Project } from '../core/format';
import type { Tag } from '../core/tags';
import type { EditorCore } from './core';
import { EditorFrames } from './frames';
import { EditorLayers } from './layers';
import { EditorPalette } from './palette';
import { EditorSelection } from './selection';
import {
  initialState,
  layerInfo,
  MAX_BRUSH,
  type EditorOptions,
  type EditorState,
  type ReferenceSettings,
  type ToolId,
} from './state';
import { EditorStrokes } from './strokes';
import { EditorView } from './view';

export type { EditorState, LayerInfo, ReferenceSettings, TileMode, ToolId } from './state';
export { MAX_BRUSH, ZOOM_STEPS } from './state';

type Listener = () => void;

/**
 * Owns the document, history and UI state. React reads state through
 * `subscribe`/`getState`; the canvas reads `sprite` pixels directly.
 */
export class Editor {
  sprite: Sprite;
  readonly history = new History();

  private state: EditorState;
  private listeners = new Set<Listener>();
  private messageTimer: ReturnType<typeof setTimeout> | undefined;
  /** What the modules below see of the editor. */
  private readonly core: EditorCore = this.createCore();
  private readonly view = new EditorView(this.core);
  private readonly palette = new EditorPalette(this.core);
  private readonly strokes = new EditorStrokes(this.core, this.view, this.palette);
  private readonly layers = new EditorLayers(this.core, this.strokes);
  private readonly selection = new EditorSelection(this.core, this.strokes, this.layers);
  private readonly frames = new EditorFrames(this.core);

  constructor(sprite: Sprite = createSprite(32, 32)) {
    this.sprite = sprite;
    this.state = initialState(sprite);
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
      tags: this.sprite.tags,
      undoLabel: this.history.undoLabel,
      redoLabel: this.history.redoLabel,
      revision: pixelsChanged ? this.state.revision + 1 : this.state.revision,
    });
  }

  private record(cmd: Command): void {
    this.history.push(cmd);
    this.commit({ dirty: true });
  }

  private createCore(): EditorCore {
    const sprite = () => this.sprite;
    const activeLayer = () => this.activeLayer;
    const stroking = () => this.stroking;
    return {
      get sprite() {
        return sprite();
      },
      history: this.history,
      get activeLayer() {
        return activeLayer();
      },
      get stroking() {
        return stroking();
      },
      getState: () => this.state,
      set: (patch) => this.set(patch),
      stage: (patch) => {
        this.state = { ...this.state, ...patch };
      },
      commit: (patch, pixelsChanged) => this.commit(patch, pixelsChanged),
      record: (cmd) => this.record(cmd),
      settle: () => this.settle(),
      notify: (message) => this.notify(message),
      canEdit: (layer) => this.canEdit(layer),
    };
  }

  notify(message: string): void {
    clearTimeout(this.messageTimer);
    this.set({ message });
    this.messageTimer = setTimeout(() => this.set({ message: null }), 2500);
  }

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

  // ---- document -----------------------------------------------------------

  get activeLayer(): Layer {
    const id = this.state.activeLayerId;
    return this.sprite.layers.find((l) => l.id === id) ?? this.sprite.layers[0];
  }

  /** Replaces the whole document. Clears history. */
  load(
    sprite: Sprite,
    options: { palette?: Color[]; indexed?: boolean; fileName?: string; dirty?: boolean } = {},
  ): void {
    this.strokes.discard();
    this.selection.discard();
    this.sprite = sprite;
    this.history.clear();
    this.commit({
      selection: null,
      frame: 0,
      playing: false,
      activeLayerId: sprite.layers[sprite.layers.length - 1].id,
      palette: options.palette?.length ? options.palette : this.state.palette,
      indexed: options.indexed ?? false,
      fileName: options.fileName ?? 'untitled',
      dirty: options.dirty ?? false,
      cursor: null,
    });
    this.zoomToFit();
  }

  newSprite(width: number, height: number): void {
    this.load(createSprite(width, height));
  }

  /** The document as saved to a `.raster` file. */
  get project(): Project {
    return { sprite: this.sprite, palette: this.state.palette, indexed: this.state.indexed };
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
      mapCels(l.cels, (pixels) => resizePixels({ ...before, pixels }, width, height, ox, oy)),
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

  // ---- strokes (strokes.ts; used by tools) ---------------------------------

  get stroking(): boolean {
    return this.strokes.stroking;
  }
  beginStroke = () => this.strokes.beginStroke();
  resetStroke = () => this.strokes.resetStroke();
  dab = (x: number, y: number, color: Color | null) => this.strokes.dab(x, y, color);
  undab = (x: number, y: number) => this.strokes.undab(x, y);
  shadeDab = (x: number, y: number, dir: 1 | -1) => this.strokes.shadeDab(x, y, dir);
  fill = (x: number, y: number, color: Color | null) => this.strokes.fill(x, y, color);
  touch = () => this.strokes.touch();
  endStroke = (label: string) => this.strokes.endStroke(label);
  cancelStroke = () => this.strokes.cancelStroke();

  // ---- history --------------------------------------------------------------

  undo(): void {
    if (this.stroking) return;
    this.settle();
    const cmd = this.history.undo();
    if (cmd) {
      this.commit({ dirty: true, frame: cmd.frame });
      this.notify(`Undo ${cmd.label}`);
    }
  }

  redo(): void {
    if (this.stroking) return;
    this.settle();
    const cmd = this.history.redo();
    if (cmd) {
      this.commit({ dirty: true, frame: cmd.frame });
      this.notify(`Redo ${cmd.label}`);
    }
  }

  // ---- colors & tools -------------------------------------------------------

  setTool(tool: ToolId): void {
    if (this.stroking || tool === this.state.tool) return;
    this.settle();
    this.set({ tool });
  }

  /** Sets the left-click color, snapped to the palette in indexed mode. */
  setPrimary(primary: Color): void {
    this.set({ primary: this.palette.snap(primary) });
  }

  setSecondary(secondary: Color): void {
    this.set({ secondary: this.palette.snap(secondary) });
  }

  swapColors(): void {
    this.set({ primary: this.state.secondary, secondary: this.state.primary });
  }

  /** Sets the square brush size. Picking a size also drops any custom brush. */
  setBrushSize(size: number): void {
    this.set({
      brushSize: Math.min(MAX_BRUSH, Math.max(1, Math.round(size))),
      customBrush: null,
    });
  }

  /**
   * Turns the selected pixels into the brush, then deselects so strokes
   * aren't clipped to the old selection. Switches to the pencil if the
   * current tool doesn't paint with a brush.
   */
  brushFromSelection(): void {
    if (this.strokes.stroking) return;
    const pixels = this.selection.selectedPixels();
    if (!pixels) {
      this.notify('Select an area to make a brush from');
      return;
    }
    const brush = makeCustomBrush(pixels);
    if (!brush) {
      this.notify('The selection is empty');
      return;
    }
    this.selection.deselect();
    const paints = ['pencil', 'eraser', 'shade', 'line', 'rect', 'ellipse'];
    this.set({
      customBrush: brush,
      tool: paints.includes(this.state.tool) ? this.state.tool : 'pencil',
    });
    this.notify(`Brush set: ${brush.width}×${brush.height}`);
  }

  /** Goes back to the square brush. */
  clearCustomBrush(): void {
    if (this.state.customBrush) this.set({ customBrush: null });
  }

  setOption(patch: Partial<EditorOptions>): void {
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
    color = this.palette.snap(color);
    if (color === this.state[target]) return;
    this.set(target === 'primary' ? { primary: color } : { secondary: color });
  }

  // ---- palette & indexed color (palette.ts) ---------------------------------

  setPalette = (palette: Color[]) => this.palette.setPalette(palette);
  setPaletteColor = (index: number, color: Color) => this.palette.setPaletteColor(index, color);
  setIndexed = (indexed: boolean) => this.palette.setIndexed(indexed);

  // ---- layers (layers.ts) ---------------------------------------------------

  setActiveLayer = (id: string) => this.layers.setActiveLayer(id);
  addLayer = () => this.layers.addLayer();
  duplicateLayer = (id?: string) => this.layers.duplicateLayer(id);
  deleteLayer = (id?: string) => this.layers.deleteLayer(id);
  moveLayer = (id: string, delta: 1 | -1) => this.layers.moveLayer(id, delta);
  mergeDown = (id?: string) => this.layers.mergeDown(id);
  updateLayer = (...args: Parameters<EditorLayers['updateLayer']>) =>
    this.layers.updateLayer(...args);
  clearLayer = () => this.layers.clearLayer();
  flip = (axis: 'horizontal' | 'vertical', scope: 'layer' | 'sprite') =>
    this.layers.flip(axis, scope);

  /** Ends an in-progress merge (e.g. when an opacity drag finishes). */
  sealHistory(): void {
    this.history.seal();
  }

  // ---- selection & clipboard (selection.ts) ---------------------------------

  /** Pixels from the last copy or cut. */
  get clipboard(): Surface | null {
    return this.selection.clipboard;
  }
  set clipboard(pixels: Surface | null) {
    this.selection.clipboard = pixels;
  }
  get hasFloating(): boolean {
    return this.selection.hasFloating;
  }
  select = (sel: Selection | null, mode?: SelectMode) => this.selection.select(sel, mode);
  selectColor = (x: number, y: number, mode?: SelectMode) => {
    [x, y] = this.wrap(x, y);
    this.selection.selectColor(x, y, mode);
  };
  selectAll = () => this.selection.selectAll();
  invertSelection = () => this.selection.invert();
  deselect = () => this.selection.deselect();
  settle = () => this.selection.settle();
  liftSelection = () => this.selection.liftSelection();
  moveFloating = (x: number, y: number) => this.selection.moveFloating(x, y);
  copy = () => this.selection.copy();
  cut = () => this.selection.cut();
  paste = (pixels: Surface | null = this.clipboard) =>
    this.selection.paste(pixels && this.palette.snapSurface(pixels));
  deleteSelection = (label?: string) => this.selection.deleteSelection(label);

  // ---- frames (frames.ts) ---------------------------------------------------

  get frameCount(): number {
    return this.frames.frameCount;
  }
  setFrame = (frame: number) => this.frames.setFrame(frame);
  nextFrame = () => this.frames.nextFrame();
  prevFrame = () => this.frames.prevFrame();
  addFrame = () => this.frames.addFrame();
  duplicateFrame = () => this.frames.duplicateFrame();
  duplicateLinkedFrame = () => this.frames.duplicateLinkedFrame();
  /** True if the active layer's current cel is shared with another frame. */
  get celLinked(): boolean {
    return this.frames.celLinked;
  }
  unlinkCel = () => this.frames.unlinkCel();
  addTag = (tag?: Partial<Tag>) => this.frames.addTag(tag);
  updateTag = (index: number, patch: Partial<Tag>) => this.frames.updateTag(index, patch);
  deleteTag = (index: number) => this.frames.deleteTag(index);
  advancePlayback = () => this.frames.advancePlayback();
  deleteFrame = () => this.frames.deleteFrame();
  moveFrame = (delta: 1 | -1) => this.frames.moveFrame(delta);
  setFrameDuration = (frame: number, ms: number) => this.frames.setFrameDuration(frame, ms);
  setAllFrameDurations = (ms: number) => this.frames.setAllFrameDurations(ms);
  setPlaying = (playing: boolean) => this.frames.setPlaying(playing);
  setOnionSkin = (onionSkin: boolean) => this.frames.setOnionSkin(onionSkin);
  flattenFrame = (frame: number) => this.frames.flattenFrame(frame);

  // ---- view & tiles (view.ts) ----------------------------------------------

  /** Screen size of the canvas viewport, in CSS pixels. */
  get viewport(): { width: number; height: number } {
    return this.view.viewport;
  }
  set viewport(viewport: { width: number; height: number }) {
    this.view.viewport = viewport;
  }
  /** A picture shown over or under the canvas to trace or compare. Not saved. */
  get referenceImage(): Surface | null {
    return this.view.referenceImage;
  }
  set referenceImage(image: Surface | null) {
    this.view.referenceImage = image;
  }
  wrap = (x: number, y: number) => this.view.wrap(x, y);
  setTileGrid = (width: number, height: number) => this.view.setTileGrid(width, height);
  setReference = (image: Surface | null) => this.view.setReference(image);
  updateReference = (patch: Partial<ReferenceSettings>) => this.view.updateReference(patch);
  setViewport = (width: number, height: number) => this.view.setViewport(width, height);
  setCursor = (cursor: { x: number; y: number } | null) => this.view.setCursor(cursor);
  setPanning = (panning: boolean) => this.view.setPanning(panning);
  setPan = (panX: number, panY: number) => this.view.setPan(panX, panY);
  setZoom = (zoom: number, sx?: number, sy?: number) => this.view.setZoom(zoom, sx, sy);
  zoomStep = (dir: 1 | -1, sx?: number, sy?: number) => this.view.zoomStep(dir, sx, sy);
  zoomToFit = () => this.view.zoomToFit();

  /** Flattened image, for export and previews. */
  flatten(): Uint32Array {
    return composite(this.sprite);
  }
}
