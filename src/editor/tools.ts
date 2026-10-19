import { PixelPerfect } from '../core/brush';
import type { Color } from '../core/color';
import {
  plotEllipse,
  plotLine,
  plotRect,
  rectContains,
  rectFromCorners,
  snapAngle,
  snapSquare,
} from '../core/raster';
import type { Editor, ToolId } from './editor';

export interface ToolEvent {
  x: number;
  y: number;
  /** 0 = primary (left), 2 = secondary (right). */
  button: number;
  shift: boolean;
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
      perfect = mode !== 'shade' && s.pixelPerfect && s.brushSize === 1 ? new PixelPerfect() : null;
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
      if (sel && rectContains(sel, e.x, e.y) && ed.liftSelection()) {
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

export const TOOLS: Tool[] = [
  selectTool(),
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
