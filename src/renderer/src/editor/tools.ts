import { PixelPerfect } from '@core/brush';
import type { Color } from '@core/color';
import { combineSelections, polygonSelection, type Point, type SelectMode } from '@core/mask';
import {
  plotEllipse,
  plotLine,
  plotRect,
  rectFromCorners,
  selectionContains,
  snapAngle,
  snapSquare,
  type Selection,
} from '@core/raster';
import type { Editor, ToolId } from './editor';

export interface ToolEvent {
  x: number;
  y: number;
  /** 0 = primary (left), 2 = secondary (right). */
  button: number;
  shift: boolean;
  /** Ctrl (Cmd on macOS) held. */
  ctrl?: boolean;
}

export interface Tool {
  id: ToolId;
  label: string;
  shortcut: string;
  down(ed: Editor, e: ToolEvent): void;
  /** Only called while a button is held. */
  move(ed: Editor, e: ToolEvent): void;
  up(ed: Editor, e: ToolEvent): void;
}

const colorFor = (ed: Editor, e: ToolEvent): Color => {
  const s = ed.getState();
  return e.button === 2 ? s.secondary : s.primary;
};

type FreehandMode = 'paint' | 'erase' | 'shade';

/**
 * Freehand tools: pencil, eraser and shade. Shift-click draws a line from the
 * last point. Pencil and eraser support pixel-perfect strokes at 1px.
 */
function freehand(id: ToolId, label: string, shortcut: string, mode: FreehandMode): Tool {
  let last: { x: number; y: number } | null = null;
  let color: Color | null = null;
  let shadeDir: 1 | -1 = 1;
  let perfect: PixelPerfect | null = null;
  const segment = (ed: Editor, x0: number, y0: number, x1: number, y1: number) =>
    plotLine(x0, y0, x1, y1, (x, y) => {
      if (mode === 'shade') {
        ed.shadeDab(x, y, shadeDir);
        return;
      }
      ed.dab(x, y, color);
      const corner = perfect?.push({ x, y });
      if (corner) ed.undab(corner.x, corner.y);
    });

  return {
    id,
    label,
    shortcut,
    down(ed, e) {
      if (!ed.beginStroke()) return;
      const s = ed.getState();
      color = mode === 'erase' ? null : colorFor(ed, e);
      shadeDir = e.button === 2 ? -1 : 1;
      const square1px = s.brushSize === 1 && !s.customBrush;
      perfect = mode !== 'shade' && s.pixelPerfect && square1px ? new PixelPerfect() : null;
      if (e.shift && last) segment(ed, last.x, last.y, e.x, e.y);
      else segment(ed, e.x, e.y, e.x, e.y);
      last = { x: e.x, y: e.y };
      ed.touch();
    },
    move(ed, e) {
      if (!ed.stroking || !last) return;
      if (last.x === e.x && last.y === e.y) return;
      segment(ed, last.x, last.y, e.x, e.y);
      last = { x: e.x, y: e.y };
      ed.touch();
    },
    up(ed) {
      ed.endStroke(label);
    },
  };
}

type ShapeDraw = (ed: Editor, x0: number, y0: number, x1: number, y1: number, color: Color) => void;

/** Drag tools that redraw a shape from the anchor on every move. */
function shape(
  id: ToolId,
  label: string,
  shortcut: string,
  snap: typeof snapAngle,
  draw: ShapeDraw,
): Tool {
  let start: { x: number; y: number } | null = null;
  let color: Color = 0;
  const render = (ed: Editor, e: ToolEvent) => {
    if (!start) return;
    const [x1, y1] = e.shift ? snap(start.x, start.y, e.x, e.y) : [e.x, e.y];
    ed.resetStroke();
    draw(ed, start.x, start.y, x1, y1, color);
    ed.touch();
  };
  return {
    id,
    label,
    shortcut,
    down(ed, e) {
      if (!ed.beginStroke()) return;
      start = { x: e.x, y: e.y };
      color = colorFor(ed, e);
      render(ed, e);
    },
    move(ed, e) {
      if (ed.stroking) render(ed, e);
    },
    up(ed, e) {
      if (!ed.stroking) return;
      render(ed, e);
      start = null;
      ed.endStroke(label);
    },
  };
}

const outlineOrFill =
  (plot: typeof plotRect): ShapeDraw =>
  (ed, x0, y0, x1, y1, color) => {
    plot(x0, y0, x1, y1, ed.getState().shapeFilled, (x, y) => ed.dab(x, y, color));
  };

/**
 * Rectangle selection. Dragging inside the selection moves its pixels;
 * dragging elsewhere selects a new area; a click without dragging deselects.
 */
function selectTool(): Tool {
  let anchor: { x: number; y: number } | null = null;
  let grab: { dx: number; dy: number } | null = null;
  let dragged = false;
  const drag = (ed: Editor, e: ToolEvent) => {
    if (grab) {
      ed.moveFloating(e.x - grab.dx, e.y - grab.dy);
    } else if (anchor) {
      if (!dragged && e.x === anchor.x && e.y === anchor.y) return;
      dragged = true;
      const [x1, y1] = e.shift ? snapSquare(anchor.x, anchor.y, e.x, e.y) : [e.x, e.y];
      ed.select(rectFromCorners(anchor.x, anchor.y, x1, y1));
    }
  };
  return {
    id: 'select',
    label: 'Select',
    shortcut: 'M',
    down(ed, e) {
      dragged = false;
      const sel = ed.getState().selection;
      if (sel && selectionContains(sel, e.x, e.y) && ed.liftSelection()) {
        grab = { dx: e.x - sel.x, dy: e.y - sel.y };
        return;
      }
      ed.settle();
      anchor = { x: e.x, y: e.y };
    },
    move: drag,
    up(ed, e) {
      drag(ed, e);
      if (anchor && !dragged) ed.deselect();
      anchor = null;
      grab = null;
    },
  };
}

/** Lasso and magic wand: Shift adds to the selection, Ctrl subtracts from it. */
const selectMode = (e: ToolEvent): SelectMode =>
  e.ctrl ? 'subtract' : e.shift ? 'add' : 'replace';

/**
 * Starts moving the selected pixels if a plain press lands inside the
 * selection. Returns the grab offset, or null.
 */
function grabSelection(ed: Editor, e: ToolEvent): { dx: number; dy: number } | null {
  const sel = ed.getState().selection;
  if (selectMode(e) !== 'replace' || !sel || !selectionContains(sel, e.x, e.y)) return null;
  return ed.liftSelection() ? { dx: e.x - sel.x, dy: e.y - sel.y } : null;
}

/**
 * Freehand lasso: drag around an area to select it; the path closes itself.
 * Dragging inside the selection moves its pixels; a click deselects.
 */
function lassoTool(): Tool {
  let points: Point[] | null = null;
  let base: Selection | null = null;
  let mode: SelectMode = 'replace';
  let grab: { dx: number; dy: number } | null = null;
  const update = (ed: Editor) => {
    const { width, height } = ed.sprite;
    const path = polygonSelection(points!, width, height);
    ed.select(combineSelections(base, path, mode, width, height));
  };
  const drag = (ed: Editor, e: ToolEvent) => {
    if (grab) {
      ed.moveFloating(e.x - grab.dx, e.y - grab.dy);
      return;
    }
    const last = points?.[points.length - 1];
    if (!points || !last || (last.x === e.x && last.y === e.y)) return;
    points.push({ x: e.x, y: e.y });
    update(ed);
  };
  return {
    id: 'lasso',
    label: 'Lasso',
    shortcut: 'Q',
    down(ed, e) {
      grab = grabSelection(ed, e);
      if (grab) return;
      ed.settle();
      mode = selectMode(e);
      base = ed.getState().selection;
      points = [{ x: e.x, y: e.y }];
    },
    move: drag,
    up(ed, e) {
      drag(ed, e);
      if (points?.length === 1 && mode === 'replace') ed.deselect();
      points = null;
      base = null;
      grab = null;
    },
  };
}

/**
 * Magic wand: click to select pixels of the same color on the active layer.
 * Dragging inside the selection moves its pixels.
 */
function wandTool(): Tool {
  let grab: { dx: number; dy: number } | null = null;
  let dragged = false;
  const drag = (ed: Editor, e: ToolEvent) => {
    const sel = ed.getState().selection;
    if (!grab || !sel || (e.x - grab.dx === sel.x && e.y - grab.dy === sel.y)) return;
    dragged = true;
    ed.moveFloating(e.x - grab.dx, e.y - grab.dy);
  };
  return {
    id: 'wand',
    label: 'Magic Wand',
    shortcut: 'W',
    down(ed, e) {
      dragged = false;
      grab = grabSelection(ed, e);
      if (!grab) ed.selectColor(e.x, e.y, selectMode(e));
    },
    move: drag,
    up(ed, e) {
      drag(ed, e);
      // A click inside the selection picks a new region.
      if (grab && !dragged) ed.selectColor(e.x, e.y);
      grab = null;
    },
  };
}

export const TOOLS: Tool[] = [
  selectTool(),
  lassoTool(),
  wandTool(),
  freehand('pencil', 'Pencil', 'B', 'paint'),
  freehand('eraser', 'Eraser', 'E', 'erase'),
  freehand('shade', 'Shade', 'D', 'shade'),
  {
    id: 'fill',
    label: 'Fill',
    shortcut: 'G',
    down(ed, e) {
      if (!ed.beginStroke()) return;
      ed.fill(e.x, e.y, colorFor(ed, e));
      ed.endStroke('Fill');
    },
    move() {},
    up() {},
  },
  shape('line', 'Line', 'L', snapAngle, (ed, x0, y0, x1, y1, color) =>
    plotLine(x0, y0, x1, y1, (x, y) => ed.dab(x, y, color)),
  ),
  shape('rect', 'Rectangle', 'U', snapSquare, outlineOrFill(plotRect)),
  shape('ellipse', 'Ellipse', 'O', snapSquare, outlineOrFill(plotEllipse)),
  {
    id: 'picker',
    label: 'Color Picker',
    shortcut: 'I',
    down(ed, e) {
      ed.pickColor(e.x, e.y, e.button === 2 ? 'secondary' : 'primary');
    },
    move(ed, e) {
      ed.pickColor(e.x, e.y, e.button === 2 ? 'secondary' : 'primary');
    },
    up() {},
  },
];

export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, Tool>;
