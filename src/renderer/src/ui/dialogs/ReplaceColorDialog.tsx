import { useState } from 'react';
import { Slider } from '../components';
import { useEditor } from '../editorContext';
import { AdjustDialog, ColorField } from './AdjustDialog';

/** Adjust › Replace Color: primary to secondary by default (Figma: Dialog / Replace Color). */
export function ReplaceColorDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const [from, setFrom] = useState(() => editor.getState().primary);
  const [to, setTo] = useState(() => editor.getState().secondary);
  const [fromOk, setFromOk] = useState(true);
  const [toOk, setToOk] = useState(true);
  // Percent of the full channel range.
  const [tolerance, setTolerance] = useState(0);

  return (
    <AdjustDialog
      adjustment={{
        kind: 'replaceColor',
        from,
        to,
        tolerance: Math.round((tolerance / 100) * 255),
      }}
      onClose={onClose}
      valid={fromOk && toOk}
      note="From starts as the primary color and To as the secondary. Tolerance 0 matches the exact color only."
    >
      <label htmlFor="replace-from">From</label>
      <ColorField id="replace-from" color={from} onChange={setFrom} onValid={setFromOk} />
      <label htmlFor="replace-to">To</label>
      <ColorField id="replace-to" color={to} onChange={setTo} onValid={setToOk} />
      <span className="form-label">Tolerance</span>
      <Slider
        ariaLabel="Tolerance"
        min={0}
        max={100}
        value={tolerance}
        onChange={setTolerance}
        display={`${tolerance}%`}
      />
    </AdjustDialog>
  );
}
