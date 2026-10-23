import { Info } from 'lucide-react';
import { useEditorState } from '../editorContext';

/** Short status messages ("Saved hero.raster"), bottom center over the canvas (Figma: Toast). */
export function Toast() {
  const message = useEditorState((s) => s.message);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div className="toast">
          <Info size={16} aria-hidden="true" />
          {message}
        </div>
      )}
    </div>
  );
}
