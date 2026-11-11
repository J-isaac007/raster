import { useState } from 'react';
import { TextInput } from '../components';
import { useEditor } from '../editorContext';
import { AdjustDialog, ColorField } from './AdjustDialog';

const MAX_OFFSET = 64;

/** The typed offset as a whole number of pixels; 0 while the field is empty or mid-edit. */
function parseOffset(text: string): number {
  const n = Math.round(Number(text));
  return Number.isFinite(n) ? Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, n)) : 0;
}

function OffsetField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="field-row">
      <TextInput
        id={id}
        type="number"
        className="input-short"
        min={-MAX_OFFSET}
        max={MAX_OFFSET}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="hint">px</span>
    </div>
  );
}

/** Adjust › Drop Shadow, in the primary color by default (Figma: Dialog / Drop Shadow). */
export function DropShadowDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const [color, setColor] = useState(() => editor.getState().primary);
  const [colorOk, setColorOk] = useState(true);
  // Kept as typed, so a lone "-" can become a negative offset.
  const [x, setX] = useState('1');
  const [y, setY] = useState('1');

  return (
    <AdjustDialog
      adjustment={{ kind: 'dropShadow', color, dx: parseOffset(x), dy: parseOffset(y) }}
      onClose={onClose}
      valid={colorOk}
      note="The shadow only fills transparent pixels, so it never covers the art."
    >
      <label htmlFor="shadow-color">Color</label>
      <ColorField id="shadow-color" color={color} onChange={setColor} onValid={setColorOk} />
      <label htmlFor="shadow-x">X offset</label>
      <OffsetField id="shadow-x" value={x} onChange={setX} />
      <label htmlFor="shadow-y">Y offset</label>
      <OffsetField id="shadow-y" value={y} onChange={setY} />
    </AdjustDialog>
  );
}
