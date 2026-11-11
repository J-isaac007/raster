import { useState } from 'react';
import type { OutlineOptions } from '@core/adjust';
import { Checkbox, Chip, Chips } from '../components';
import { useEditor } from '../editorContext';
import { AdjustDialog, ColorField } from './AdjustDialog';

const PLACES: [OutlineOptions['place'], string][] = [
  ['outside', 'Outside'],
  ['inside', 'Inside'],
];

/** Adjust › Outline, in the primary color by default (Figma: Dialog / Outline). */
export function OutlineDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const [color, setColor] = useState(() => editor.getState().primary);
  const [colorOk, setColorOk] = useState(true);
  const [place, setPlace] = useState<OutlineOptions['place']>('outside');
  const [diagonals, setDiagonals] = useState(false);

  return (
    <AdjustDialog
      adjustment={{ kind: 'outline', color, place, diagonals }}
      onClose={onClose}
      valid={colorOk}
    >
      <label htmlFor="outline-color">Color</label>
      <ColorField id="outline-color" color={color} onChange={setColor} onValid={setColorOk} />
      <span className="form-label">Place</span>
      <Chips>
        {PLACES.map(([p, label]) => (
          <Chip key={p} pressed={place === p} onClick={() => setPlace(p)}>
            {label}
          </Chip>
        ))}
      </Chips>
      <span className="form-label">Corners</span>
      <Checkbox label="Include diagonals" checked={diagonals} onChange={setDiagonals} />
    </AdjustDialog>
  );
}
