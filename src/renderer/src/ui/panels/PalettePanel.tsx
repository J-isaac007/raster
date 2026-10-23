import { Minus, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toHex } from '@core/color';
import { PRESETS } from '@core/palette';
import { Checkbox, IconButton, PanelSection, Select, Swatch } from '../components';
import { PaletteColorDialog } from '../dialogs';
import { useEditor, useEditorState } from '../editorContext';

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
    <PanelSection
      title="Palette"
      actions={
        <>
          <IconButton
            icon={Plus}
            label="Add primary color"
            disabled={selected >= 0}
            onClick={add}
          />
          <IconButton
            icon={Minus}
            label="Remove selected color"
            disabled={selected < 0}
            onClick={remove}
          />
          <IconButton
            icon={Pencil}
            label="Swap selected color everywhere"
            disabled={selected < 0}
            onClick={() => setEditing(selected)}
          />
        </>
      }
    >
      <Select
        aria-label="Palette preset"
        value=""
        onChange={(e) => {
          const preset = PRESETS.find((p) => p.name === e.target.value);
          if (preset) editor.setPalette([...preset.colors]);
        }}
      >
        <option value="" disabled>
          Load a preset…
        </option>
        {PRESETS.map((p) => (
          <option key={p.name}>{p.name}</option>
        ))}
      </Select>
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
      <Checkbox
        label="Indexed color"
        title="Snap every pixel and drawing color to the palette (Shift+I)"
        checked={indexed}
        onChange={(on) => editor.setIndexed(on)}
      />
      {editing !== null && <PaletteColorDialog index={editing} onClose={() => setEditing(null)} />}
    </PanelSection>
  );
}
