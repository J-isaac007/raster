import { ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { alpha, fromHex, toHex, withAlpha, type Color } from '@core/color';
import { IconButton, PanelSection, Slider, Swatch, TextInput } from '../components';
import { useEditor, useEditorState } from '../editorContext';

export function ColorPanel() {
  const editor = useEditor();
  const { primary, secondary } = useEditorState((s) => ({
    primary: s.primary,
    secondary: s.secondary,
  }));
  const [target, setTarget] = useState<'primary' | 'secondary'>('primary');
  const color = target === 'primary' ? primary : secondary;
  const setColor = (c: Color) =>
    target === 'primary' ? editor.setPrimary(c) : editor.setSecondary(c);

  // While the hex field is being edited it holds a draft; otherwise it mirrors the color.
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const hexValue = hexDraft ?? toHex(color);
  const hexValid = fromHex(hexValue) !== null;

  const commitHex = () => {
    const c = hexDraft === null ? null : fromHex(hexDraft);
    if (c !== null) setColor(c);
    setHexDraft(null);
  };

  return (
    <PanelSection title="Color">
      <div className="colors">
        <div className="color-pair">
          <button
            className="color-chip secondary"
            aria-pressed={target === 'secondary'}
            title="Secondary color (right click)"
            onClick={() => setTarget('secondary')}
          >
            <Swatch color={secondary} />
          </button>
          <button
            className="color-chip primary"
            aria-pressed={target === 'primary'}
            title="Primary color (left click)"
            onClick={() => setTarget('primary')}
          >
            <Swatch color={primary} />
          </button>
        </div>
        <IconButton
          icon={ArrowUpDown}
          label="Swap colors"
          shortcut="X"
          onClick={() => editor.swapColors()}
        />
        <input
          type="color"
          className="native-color"
          aria-label="Pick color"
          value={toHex(color, false)}
          onChange={(e) => setColor(withAlpha(fromHex(e.target.value)!, alpha(color) || 255))}
        />
        <TextInput
          mono
          aria-label="Hex color"
          invalid={!hexValid}
          value={hexValue}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      <Slider
        label="Alpha"
        min={0}
        max={255}
        value={alpha(color)}
        display={`${Math.round((alpha(color) / 255) * 100)}%`}
        onChange={(a) => setColor(withAlpha(color, a))}
      />
    </PanelSection>
  );
}
