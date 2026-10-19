import { Eye, EyeOff, X } from 'lucide-react';
import { useEditor, useEditorState } from '../editor/context';

/** Controls for the reference image overlay. Shown only while one is loaded. */
export function ReferencePanel() {
  const editor = useEditor();
  const reference = useEditorState((s) => s.reference);
  if (!reference) return null;

  return (
    <section className="panel" aria-label="Reference image">
      <div className="panel-head">
        <span className="panel-title">Reference</span>
        <div className="icon-row">
          <button
            className="icon-btn"
            title={reference.visible ? 'Hide reference (Shift+R)' : 'Show reference (Shift+R)'}
            aria-label={reference.visible ? 'Hide reference' : 'Show reference'}
            onClick={() => editor.updateReference({ visible: !reference.visible })}
          >
            {reference.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            className="icon-btn"
            title="Remove reference image"
            aria-label="Remove reference image"
            onClick={() => editor.setReference(null)}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="field-row">
        <span className="hint">Opacity</span>
        <input
          type="range"
          min={5}
          max={100}
          aria-label="Reference opacity"
          value={Math.round(reference.opacity * 100)}
          onChange={(e) => editor.updateReference({ opacity: +e.target.value / 100 })}
        />
        <span className="range-label">{Math.round(reference.opacity * 100)}%</span>
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        <button
          className="chip"
          aria-pressed={!reference.above}
          onClick={() => editor.updateReference({ above: false })}
        >
          Behind art
        </button>
        <button
          className="chip"
          aria-pressed={reference.above}
          onClick={() => editor.updateReference({ above: true })}
        >
          Over art
        </button>
      </div>
    </section>
  );
}
