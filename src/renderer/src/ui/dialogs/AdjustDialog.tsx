import { useEffect, useState, type ReactNode } from 'react';
import { ADJUSTMENT_LABELS, type Adjustment } from '@core/adjust';
import { alpha, fromHex, toHex, withAlpha, type Color } from '@core/color';
import { Button, Checkbox, Swatch, TextInput } from '../components';
import { useEditor } from '../editorContext';
import { Dialog, DialogActions, DialogNote } from './Dialog';

/**
 * The shell of the Adjust menu's dialogs (Figma: Dialog / Hue/Saturation and
 * siblings). It docks beside the canvas without dimming it and previews
 * `adjustment` live. Apply (or Enter) commits one undo step; every other way
 * of closing puts the pixels back.
 */
export function AdjustDialog({
  adjustment,
  onClose,
  note,
  valid = true,
  children,
}: {
  adjustment: Adjustment;
  onClose: () => void;
  note?: ReactNode;
  /** False while a field holds something that can't be applied. */
  valid?: boolean;
  /** The form rows, laid out in a `form-grid`. */
  children: ReactNode;
}) {
  const editor = useEditor();
  const [preview, setPreview] = useState(true);
  const { kind } = adjustment;

  // Starts the preview on the first run (later runs find it open) and
  // re-renders it whenever a setting changes. Closes if the layer is locked
  // or hidden.
  const key = JSON.stringify(adjustment);
  useEffect(() => {
    if (!editor.beginAdjust(kind)) {
      onClose();
      return;
    }
    editor.previewAdjust(preview ? (JSON.parse(key) as Adjustment) : null);
  }, [editor, kind, key, preview, onClose]);

  // Unmounting cancels, which covers Cancel, Escape and clicks outside; after
  // Apply there is nothing left to cancel.
  useEffect(() => () => editor.cancelAdjust(), [editor]);

  const apply = () => {
    if (!valid) return;
    editor.applyAdjust(adjustment);
    onClose();
  };

  return (
    <Dialog title={ADJUSTMENT_LABELS[kind]} onClose={onClose} docked>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        onKeyDown={(e) => {
          // Sliders and checkboxes don't submit on Enter by themselves.
          if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            apply();
          }
        }}
      >
        <div className="form-grid">{children}</div>
        {note && <DialogNote>{note}</DialogNote>}
        <DialogActions>
          <Checkbox
            label="Preview"
            checked={preview}
            onChange={setPreview}
            className="dialog-preview"
          />
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!valid}>
            Apply
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/**
 * A color as a swatch that opens the system picker, plus its hex code (which
 * can carry alpha). Calls `onChange` with valid colors only; `onValid` says
 * whether the hex field parses.
 */
export function ColorField({
  id,
  color,
  onChange,
  onValid,
}: {
  id: string;
  color: Color;
  onChange: (color: Color) => void;
  onValid?: (valid: boolean) => void;
}) {
  const [hex, setHex] = useState(() => toHex(color));
  const parsed = fromHex(hex);
  const setText = (text: string) => {
    setHex(text);
    const c = fromHex(text);
    onValid?.(c !== null);
    if (c !== null) onChange(c);
  };
  return (
    <div className="field-row">
      <label className="color-preview color-pick" title="Pick a color">
        <Swatch color={color} />
        <input
          type="color"
          aria-label="Pick a color"
          value={toHex(color, false)}
          // The system picker has no alpha; keep the current one.
          onChange={(e) => setText(toHex(withAlpha(fromHex(e.target.value)!, alpha(color))))}
        />
      </label>
      <TextInput
        id={id}
        mono
        className="input-hex"
        invalid={parsed === null}
        value={hex}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}
