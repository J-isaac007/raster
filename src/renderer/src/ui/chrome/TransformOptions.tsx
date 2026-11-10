import { useState } from 'react';
import { MAX_TRANSFORM_SCALE, MIN_TRANSFORM_SCALE, type FreeTransformInfo } from '@editor/editor';
import { Button, Checkbox, Chip, TextInput } from '../components';
import { useEditor, useEditorState } from '../editorContext';

const ANGLES = [15, 30, 45, 90, 180];

interface NumberFieldProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange(n: number): void;
}

/**
 * A number field that follows `value` (the handles change it) but keeps what
 * is being typed until it loses focus. Enter applies, Escape cancels.
 */
function NumberField({ label, unit, value, min, max, onChange }: NumberFieldProps) {
  const editor = useEditor();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="option-field">
      <span className="option-label">{label}</span>
      <TextInput
        className="transform-number"
        type="number"
        min={min}
        max={max}
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            editor.applyTransform();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            editor.cancelTransform();
          }
        }}
      />
      <span className="option-label">{unit}</span>
    </label>
  );
}

/**
 * Tool options while a transform is open: the numbers behind the handles on
 * the canvas, kept in sync both ways, plus Cancel and Apply.
 */
export function TransformOptions({ transform: t }: { transform: FreeTransformInfo }) {
  const editor = useEditor();
  const keep = useEditorState((s) => s.transformKeep);
  const pct = (scale: number) => Math.round(scale * 100);
  const minPct = MIN_TRANSFORM_SCALE * 100;
  const maxPct = MAX_TRANSFORM_SCALE * 100;

  /** Sets one side's percentage; with Keep proportions the other side follows by the same factor. */
  const scale = (axis: 'x' | 'y', percent: number) => {
    const next = percent / 100;
    const [own, other] = axis === 'x' ? [t.scaleX, t.scaleY] : [t.scaleY, t.scaleX];
    const follow = keep ? (other * next) / own : other;
    editor.setTransform(
      axis === 'x' ? { scaleX: next, scaleY: follow } : { scaleY: next, scaleX: follow },
    );
  };

  return (
    <>
      <span className="divider" />
      <NumberField
        label="Angle"
        unit="°"
        min={-360}
        max={360}
        value={t.angle}
        onChange={(angle) => editor.setTransform({ angle })}
      />
      <div className="option-field" role="group" aria-label="Angle presets">
        {ANGLES.map((a) => (
          <Chip key={a} pressed={t.angle === a} onClick={() => editor.setTransform({ angle: a })}>
            {a}°
          </Chip>
        ))}
      </div>
      <span className="divider" />
      <NumberField
        label="Width"
        unit="%"
        min={minPct}
        max={maxPct}
        value={pct(t.scaleX)}
        onChange={(n) => scale('x', n)}
      />
      <NumberField
        label="Height"
        unit="%"
        min={minPct}
        max={maxPct}
        value={pct(t.scaleY)}
        onChange={(n) => scale('y', n)}
      />
      <Checkbox
        label="Keep proportions"
        title="Corner handles and these fields change width and height together (hold Shift while dragging to switch)"
        checked={keep}
        onChange={(transformKeep) => editor.setOption({ transformKeep })}
      />
      <span className="options-spacer" />
      <span className="mono option-label" title="Size after scaling">
        {t.box.width} × {t.box.height} px
      </span>
      <Button variant="ghost" onClick={() => editor.cancelTransform()}>
        Cancel
      </Button>
      <Button variant="primary" onClick={() => editor.applyTransform()}>
        Apply
      </Button>
    </>
  );
}
