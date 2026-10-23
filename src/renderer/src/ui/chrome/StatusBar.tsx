import { ZoomIn, ZoomOut } from 'lucide-react';
import type { ToolId } from '@editor/editor';
import { IconButton } from '../components';
import { useEditor, useEditorState } from '../editorContext';

/** How to use each tool, shown on the right of the status bar. */
const HINTS: Record<ToolId, string> = {
  select: 'Drag to select · Drag inside to move · Shift for a square · Click to deselect',
  lasso: 'Drag around an area · Drag inside to move · Shift adds · Ctrl subtracts',
  wand: 'Click a color to select it · Drag inside to move · Shift adds · Ctrl subtracts',
  pencil:
    'Click to draw · Shift+click draws a line · Alt+click picks a color · Right click paints the secondary color',
  eraser: 'Click to erase · Shift+click erases a line',
  shade: 'Left click lightens, right click darkens · Steps along palette ramps',
  fill: 'Click to fill · Right click fills with the secondary color',
  line: 'Drag to draw a line · Shift snaps the angle · Right click uses the secondary color',
  rect: 'Drag to draw · Shift makes a square · Right click uses the secondary color',
  ellipse: 'Drag to draw · Shift makes a circle · Right click uses the secondary color',
  picker: 'Left click picks the primary color, right click the secondary',
};

export function StatusBar() {
  const editor = useEditor();
  const s = useEditorState((s) => ({
    cursor: s.cursor,
    width: s.width,
    height: s.height,
    zoom: s.zoom,
    tool: s.tool,
    selection: s.selection,
  }));
  const inside =
    s.cursor && s.cursor.x >= 0 && s.cursor.y >= 0 && s.cursor.x < s.width && s.cursor.y < s.height;

  return (
    <footer className="statusbar">
      <span className="mono" title="Cursor position">
        {inside ? `${s.cursor!.x}, ${s.cursor!.y}` : '–, –'}
      </span>
      <span className="mono" title={s.selection ? 'Selection size' : 'Sprite size'}>
        {s.selection
          ? `Selection ${s.selection.width} × ${s.selection.height}`
          : `${s.width} × ${s.height}`}
      </span>
      <div className="zoom">
        <IconButton
          icon={ZoomOut}
          label="Zoom out"
          shortcut="-"
          onClick={() => editor.zoomStep(-1)}
        />
        <span className="mono zoom-value" title="Zoom">
          {Math.round(s.zoom * 100)}%
        </span>
        <IconButton icon={ZoomIn} label="Zoom in" shortcut="=" onClick={() => editor.zoomStep(1)} />
      </div>
      <span className="divider" />
      <span className="status-hint">{HINTS[s.tool]}</span>
    </footer>
  );
}
