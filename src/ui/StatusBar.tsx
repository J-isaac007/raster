import { useEditorState } from '../editor/context';

export function StatusBar() {
  const s = useEditorState((s) => ({
    cursor: s.cursor,
    width: s.width,
    height: s.height,
    zoom: s.zoom,
    message: s.message,
  }));
  const inside =
    s.cursor && s.cursor.x >= 0 && s.cursor.y >= 0 && s.cursor.x < s.width && s.cursor.y < s.height;

  return (
    <footer className="statusbar">
      <span title="Cursor position">{inside ? `${s.cursor!.x}, ${s.cursor!.y}` : '–, –'}</span>
      <span title="Sprite size">
        {s.width} × {s.height}
      </span>
      <span title="Zoom">{Math.round(s.zoom * 100)}%</span>
      <span className="message" role="status" aria-live="polite">
        {s.message}
      </span>
    </footer>
  );
}
