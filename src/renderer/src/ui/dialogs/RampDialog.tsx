import { useMemo, useState } from 'react';
import { alpha, toHex } from '@core/color';
import { DEFAULT_RAMP, makeRamp, MAX_RAMP_STEPS, MIN_RAMP_STEPS } from '@core/ramp';
import { Button, Slider, Swatch } from '../components';
import { useEditor } from '../editorContext';
import { Dialog, DialogActions, DialogNote } from './Dialog';

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Palette › New Ramp: hue-shifted shades of the primary color, added to the palette. */
export function RampDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const [base] = useState(() => editor.getState().primary);
  const [steps, setSteps] = useState(DEFAULT_RAMP.steps);
  const [hueShift, setHueShift] = useState(DEFAULT_RAMP.hueShift);
  // Percent, as the sliders show them.
  const [saturation, setSaturation] = useState(Math.round(DEFAULT_RAMP.saturationShift * 100));
  const [range, setRange] = useState(Math.round(DEFAULT_RAMP.lightRange * 100));

  const ramp = useMemo(
    () =>
      makeRamp(base, {
        steps,
        hueShift,
        saturationShift: saturation / 100,
        lightRange: range / 100,
      }),
    [base, steps, hueShift, saturation, range],
  );
  const visible = alpha(base) > 0;

  const add = () => {
    editor.addRamp(base, ramp);
    onClose();
  };

  return (
    <Dialog title="New Ramp" onClose={onClose} className="ramp-dialog">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (visible) add();
        }}
      >
        <div className="form-grid">
          <span className="form-label">Base</span>
          <div className="field-row">
            <span className="color-preview">
              <Swatch color={base} />
            </span>
            <span className="mono">{toHex(base)}</span>
            <span className="ramp-base-note">Primary color</span>
          </div>
          <span className="form-label">Steps</span>
          <Slider
            ariaLabel="Steps"
            min={MIN_RAMP_STEPS}
            max={MAX_RAMP_STEPS}
            value={steps}
            display={String(steps)}
            onChange={setSteps}
          />
          <span className="form-label">Hue shift</span>
          <Slider
            ariaLabel="Hue shift"
            min={0}
            max={60}
            value={hueShift}
            display={`${hueShift}°`}
            onChange={setHueShift}
          />
          <span className="form-label">Saturation</span>
          <Slider
            ariaLabel="Saturation shift"
            min={-50}
            max={50}
            value={saturation}
            display={`${signed(saturation)}%`}
            onChange={setSaturation}
          />
          <span className="form-label">Light range</span>
          <Slider
            ariaLabel="Light range"
            min={20}
            max={90}
            value={range}
            display={`${range}%`}
            onChange={setRange}
          />
        </div>
        <div className="ramp-preview" role="list" aria-label="Ramp preview">
          {ramp.map((c, i) => (
            <div
              key={i}
              className="ramp-step"
              role="listitem"
              aria-label={c === base ? `${toHex(c)} (base)` : toHex(c)}
              title={toHex(c)}
            >
              <span className="ramp-swatch">
                <Swatch color={c} />
                {c === base && <span className="ramp-base-marker" />}
              </span>
              {/* Past 7 steps the codes no longer fit under the swatches; hover shows them. */}
              {ramp.length <= 7 && (
                <span className={c === base ? 'ramp-hex is-base' : 'ramp-hex'}>{toHex(c)}</span>
              )}
            </div>
          ))}
        </div>
        <DialogNote>
          {visible
            ? 'Darker steps shift toward cool blue and lighter steps toward warm yellow. The ramp goes into the palette around the base color, darkest first, so the Shade tool steps along it. Undoes in one step.'
            : 'The primary color is fully transparent. Pick a visible color first.'}
        </DialogNote>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!visible}>
            Add to Palette
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
