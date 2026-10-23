import { DITHER_LEVELS, type BrushMode, type CustomBrush } from '@core/brush';
import { rgba, TRANSPARENT, type Color } from '@core/color';
import { DEFAULT_PALETTE } from '@core/palette';
import type { Selection } from '@core/raster';
import { DEFAULT_FRAME_MS, type Layer, type Sprite } from '@core/sprite';
import type { Tag } from '@core/tags';

export type ToolId =
  | 'select'
  | 'lasso'
  | 'wand'
  | 'pencil'
  | 'eraser'
  | 'shade'
  | 'fill'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'picker';

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
  /** Indexed color mode: pixels and drawing colors always come from the palette. */
  indexed: boolean;
  brushSize: number;
  /** A brush made from a selection; replaces the square brush while set. */
  customBrush: CustomBrush | null;
  /** How a custom brush paints: its own colors, or the current color in its shape. */
  brushMode: BrushMode;
  shapeFilled: boolean;
  fillContiguous: boolean;
  /** The magic wand selects only pixels connected to the one clicked. */
  wandContiguous: boolean;
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
  selection: Selection | null;
  /** Index of the frame being viewed and edited. */
  frame: number;
  /** Frame durations in ms, one per frame. */
  frames: number[];
  /** Named frame ranges (animation loops). */
  tags: Tag[];
  playing: boolean;
  onionSkin: boolean;
  undoLabel?: string;
  redoLabel?: string;
  fileName: string;
  dirty: boolean;
  message: string | null;
  /** Bumps whenever pixel data changes. */
  revision: number;
  /** Bumps whenever the document is replaced (new sprite, file opened). */
  documentId: number;
}

/** The on/off and mode settings `Editor.setOption` changes. */
export type EditorOptions = Pick<
  EditorState,
  | 'shapeFilled'
  | 'fillContiguous'
  | 'wandContiguous'
  | 'mirrorX'
  | 'mirrorY'
  | 'showGrid'
  | 'pixelPerfect'
  | 'dither'
  | 'brushMode'
  | 'tileMode'
  | 'showTileGrid'
>;

export const ZOOM_STEPS = [0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
export const MAX_BRUSH = 32;

export const clampDuration = (ms: number) =>
  Math.min(60000, Math.max(10, Math.round(ms) || DEFAULT_FRAME_MS));

export const layerInfo = (l: Layer): LayerInfo => ({
  id: l.id,
  name: l.name,
  visible: l.visible,
  locked: l.locked,
  opacity: l.opacity,
});

/** The state of a freshly opened editor showing `sprite`. */
export function initialState(sprite: Sprite): EditorState {
  return {
    width: sprite.width,
    height: sprite.height,
    layers: sprite.layers.map(layerInfo),
    activeLayerId: sprite.layers[sprite.layers.length - 1].id,
    tool: 'pencil',
    primary: rgba(0, 0, 0),
    secondary: TRANSPARENT,
    palette: [...DEFAULT_PALETTE],
    indexed: false,
    brushSize: 1,
    customBrush: null,
    brushMode: 'image',
    shapeFilled: false,
    fillContiguous: true,
    wandContiguous: true,
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
    tags: sprite.tags,
    playing: false,
    onionSkin: false,
    fileName: 'untitled',
    dirty: false,
    message: null,
    documentId: 0,
    revision: 0,
  };
}
