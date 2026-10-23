import { useState } from 'react';
import { alpha, fromHex, toHex, withAlpha } from '@core/color';
import { Button, Swatch, TextInput } from '../components';
import { useEditor } from '../editorContext';
import { Dialog, DialogActions, DialogNote } from './Dialog';

export function PaletteColorDialog({ index, onClose }: { index: number; onClose: () => void }) {
  const editor = useEditor();
  const { palette, indexed } = editor.getState();
  const old = palette[index];
  const [hex, setHex] = useState(old === undefined ? '#000000' : toHex(old));
  const color = fromHex(hex);

  if (old === undefined) return null;
  const save = () => {
    if (color === null) return;
    editor.setPaletteColor(index, color);
    onClose();
  };

  return (
    <Dialog title="Swap Palette Color" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="form-grid">
          <span className="form-label">From</span>
          <div className="field-row">
            <span className="color-preview">
              <Swatch color={old} />
            </span>
            <span className="mono">{toHex(old)}</span>
          </div>
          <label htmlFor="palette-hex">To</label>
          <div className="field-row">
            <input
              type="color"
              className="native-color"
              aria-label="Pick color"
              value={toHex(color ?? old, false)}
              onChange={(e) =>
                setHex(toHex(withAlpha(fromHex(e.target.value)!, alpha(color ?? old))))
              }
            />
            <TextInput
              id="palette-hex"
              mono
              invalid={color === null}
              value={hex}
              onChange={(e) => setHex(e.target.value)}
            />
          </div>
        </div>
        <DialogNote>
          {indexed
            ? 'Every pixel using this palette entry changes to the new color.'
            : `Every ${toHex(old)} pixel changes to the new color.`}{' '}
          This covers all layers and frames, and undoes in one step.
        </DialogNote>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={color === null}>
            Swap
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
