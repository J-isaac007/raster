import { ArrowUpDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { alpha, fromHex, toHex, withAlpha, type Color } from '@core/color';
import { ColorWheel, IconButton, PanelSection, Slider, Swatch, TextInput } from '../components';
import { useEditor, useEditorState } from '../editorContext';

export function ColorPanel() {
  const editor = useEditor();
  const { primary, secondary, recentColors } = useEditorState((s) => ({
    primary: s.primary,
    secondary: s.secondary,
    recentColors: s.recentColors,
  }));
  const [target, setTarget] = useState<'primary' | 'secondary'>('primary');
  const color = target === 'primary' ? primary : secondary;
  const setColor = (c: Color) =>
    target === 'primary' ? editor.setPrimary(c) : editor.setSecondary(c);
  // Remembers the color as it ended up (snapped to the palette in indexed mode).
  const remember = () => editor.rememberColor(editor.getState()[target]);

  // While the hex field is being edited it holds a draft; otherwise it mirrors the color.
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const hexValue = hexDraft ?? toHex(color);
  const hexValid = fromHex(hexValue) !== null;

  const commitHex = () => {
    const c = hexDraft === null ? null : fromHex(hexDraft);
    if (c !== null) {
      setColor(c);
      remember();
    }
    setHexDraft(null);
  };

  // The native picker fires `input` while it is open and `change` once a color is chosen.
  const nativeRef = useRef<HTMLInputElement>(null);
  const rememberRef = useRef(remember);
  useEffect(() => {
    rememberRef.current = remember;
  });
  useEffect(() => {
    const input = nativeRef.current;
    const onChange = () => rememberRef.current();
    input?.addEventListener('change', onChange);
    return () => input?.removeEventListener('change', onChange);
  }, []);

  return (
    <PanelSection title="Color">
      <ColorWheel color={color} onChange={setColor} onCommit={remember} />
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
          ref={nativeRef}
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
      {recentColors.length > 0 && (
        <div className="recent-colors">
          <span className="recent-colors-label" id="recent-colors-label">
            Recent
          </span>
          <div className="recent-swatches" role="group" aria-labelledby="recent-colors-label">
            {recentColors.map((c) => (
              <button
                key={c}
                className="recent-swatch"
                aria-label={`Recent color ${toHex(c)}`}
                title={`${toHex(c)} — left: primary, right: secondary`}
                onClick={() => editor.setPrimary(c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  editor.setSecondary(c);
                }}
              >
                <Swatch color={c} />
              </button>
            ))}
          </div>
        </div>
      )}
    </PanelSection>
  );
}
