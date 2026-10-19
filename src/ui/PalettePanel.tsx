import { Minus, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toHex } from '../core/color';
import { PRESETS } from '../core/palette';
import { useEditor, useEditorState } from '../editor/context';
import { Swatch } from './ColorPanel';
import { PaletteColorDialog } from './Dialogs';

export function PalettePanel() {
  const editor = useEditor();
  const { palette, primary, indexed } = useEditorState((s) => ({
    palette: s.palette,
    primary: s.primary,
    indexed: s.indexed,
  }));
  const selected = palette.indexOf(primary);
  const [editing, setEditing] = useState<number | null>(null);

  const add = () => {
    if (selected < 0) editor.setPalette([...palette, primary]);
  };
  const remove = () => {
    if (selected >= 0) editor.setPalette(palette.filter((_, i) => i !== selected));
  };

  return (
    <section className="panel" aria-label="Palette">
      <div className="panel-head">
        <span className="panel-title">Palette</span>
        <div className="icon-row">
          <select
            className="text-input"
            aria-label="Palette preset"
            style={{ height: 24, width: 84, padding: '0 4px' }}
            value=""
            onChange={(e) => {
              const preset = PRESETS.find((p) => p.name === e.target.value);
              if (preset) editor.setPalette([...preset.colors]);
            }}
          >
            <option value="" disabled>
              Presets…
            </option>
            {PRESETS.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </select>
          <button
            className="icon-btn"
            title="Add primary color to palette"
            aria-label="Add color"
            disabled={selected >= 0}
            onClick={add}
          >
            <Plus size={14} />
          </button>
          <button
            className="icon-btn"
            title="Remove selected color"
            aria-label="Remove color"
            disabled={selected < 0}
            onClick={remove}
          >
            <Minus size={14} />
          </button>
          <button
            className="icon-btn"
            title="Swap selected color everywhere it's used (or double-click a swatch)"
            aria-label="Swap color"
            disabled={selected < 0}
            onClick={() => setEditing(selected)}
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>
      <div className="palette" aria-label="Palette colors">
        {palette.map((c, i) => (
          <button
            key={`${i}-${c}`}
            className="palette-swatch"
            aria-pressed={i === selected}
            title={`${toHex(c)} — left: primary, right: secondary, double-click: swap`}
            onClick={() => editor.setPrimary(c)}
            onDoubleClick={() => setEditing(i)}
            onContextMenu={(e) => {
              e.preventDefault();
              editor.setSecondary(c);
            }}
          >
            <Swatch color={c} />
          </button>
        ))}
      </div>
      <label
        className="hint"
        style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}
        title="Snap every pixel and drawing color to the palette (Shift+I)"
      >
        <input
          type="checkbox"
          checked={indexed}
          onChange={(e) => editor.setIndexed(e.target.checked)}
        />
        Indexed color
      </label>
      {editing !== null && <PaletteColorDialog index={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
