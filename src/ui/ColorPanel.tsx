import { ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { alpha, fromHex, toHex, withAlpha, type Color } from '../core/color';
import { useEditor, useEditorState } from '../editor/context';

export function Swatch({ color }: { color: Color }) {
  return (
    <span className="checker" style={{ display: 'block', width: '100%', height: '100%' }}>
      <span className="swatch-fill" style={{ display: 'block', background: toHex(color, true) }} />
    </span>
  );
}

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
    <section className="panel" aria-label="Colors">
      <div className="panel-head">
        <span className="panel-title">Color</span>
      </div>
      <div className="colors">
        <div className="color-pair">
          <button
            className="color-chip primary"
            aria-pressed={target === 'primary'}
            title="Primary color (left click)"
            onClick={() => setTarget('primary')}
          >
            <Swatch color={primary} />
          </button>
          <button
            className="color-chip secondary"
            aria-pressed={target === 'secondary'}
            title="Secondary color (right click)"
            onClick={() => setTarget('secondary')}
          >
            <Swatch color={secondary} />
          </button>
          <button
            className="icon-btn swap-btn"
            title="Swap colors (X)"
            aria-label="Swap colors"
            onClick={() => editor.swapColors()}
            style={{ width: 18, height: 18 }}
          >
            <ArrowUpDown size={12} />
          </button>
        </div>

        <div className="color-fields">
          <div className="field-row">
            <input
              type="color"
              className="native-color"
              aria-label="Pick color"
              value={toHex(color, false)}
              onChange={(e) => setColor(withAlpha(fromHex(e.target.value)!, alpha(color) || 255))}
            />
            <input
              className="text-input mono"
              aria-label="Hex color"
              aria-invalid={!hexValid}
              spellCheck={false}
              value={hexValue}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </div>
          <div className="field-row" title="Alpha">
            <span className="hint">A</span>
            <input
              type="range"
              min={0}
              max={255}
              aria-label="Alpha"
              value={alpha(color)}
              onChange={(e) => setColor(withAlpha(color, +e.target.value))}
            />
            <span className="range-label">{Math.round((alpha(color) / 255) * 100)}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
