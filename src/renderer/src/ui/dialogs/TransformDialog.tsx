import { useMemo, useState } from 'react';
import { transformSurface } from '@core/transform';
import { pixelsToCanvas } from '@platform/image';
import { Button, Checkbox, Chip, Chips, TextInput } from '../components';
import { useEditor } from '../editorContext';
import { Dialog, DialogActions, DialogNote } from './Dialog';
import { Preview } from './Preview';

const ANGLES = [15, 30, 45, 90, 180];
const MAX_SCALE = 1000;

const clampScale = (n: number) => Math.min(MAX_SCALE, Math.max(1, Math.round(n) || 1));

/** Rotates by any angle and scales the selection, or the whole layer with nothing selected. */
export function TransformDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const hasSelection = editor.getState().selection !== null;
  const [angle, setAngle] = useState(0);
  const [scaleX, setScaleX] = useState(100);
  const [scaleY, setScaleY] = useState(100);
  const [keep, setKeep] = useState(true);

  const source = useMemo(() => {
    const layer = editor.activeLayer;
    return (
      editor.selectedPixels() ?? {
        width: layer.width,
        height: layer.height,
        pixels: layer.pixels.slice(),
      }
    );
  }, [editor]);

  const transform = useMemo(
    () => ({
      angle: Number.isFinite(angle) ? angle : 0,
      scaleX: clampScale(scaleX) / 100,
      scaleY: clampScale(scaleY) / 100,
    }),
    [angle, scaleX, scaleY],
  );
  const result = useMemo(() => transformSurface(source, transform), [source, transform]);
  const preview = useMemo(
    () => pixelsToCanvas(result.pixels, result.width, result.height, 1).toDataURL(),
    [result],
  );

  const changeX = (n: number) => {
    setScaleX(n);
    if (keep) setScaleY(n);
  };
  const changeY = (n: number) => {
    setScaleY(n);
    if (keep) setScaleX(n);
  };

  const apply = () => {
    editor.transformSelection(transform);
    onClose();
  };

  return (
    <Dialog title={hasSelection ? 'Transform Selection' : 'Transform Layer'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <Preview src={preview} alt="Transform preview" minWidth={Math.min(130, result.width * 4)} />
        <div className="form-grid">
          <label htmlFor="transform-angle">Angle</label>
          <div className="field-row">
            <TextInput
              id="transform-angle"
              className="input-short"
              type="number"
              min={-360}
              max={360}
              value={angle}
              onChange={(e) => setAngle(+e.target.value)}
            />
            <span className="hint">°</span>
          </div>
          <span className="form-label">Presets</span>
          <Chips>
            {ANGLES.map((a) => (
              <Chip key={a} pressed={angle === a} onClick={() => setAngle(a)}>
                {a}°
              </Chip>
            ))}
          </Chips>
          <label htmlFor="transform-sx">Width</label>
          <div className="field-row">
            <TextInput
              id="transform-sx"
              className="input-short"
              type="number"
              min={1}
              max={MAX_SCALE}
              value={scaleX}
              onChange={(e) => changeX(+e.target.value)}
            />
            <span className="hint">%</span>
          </div>
          <label htmlFor="transform-sy">Height</label>
          <div className="field-row">
            <TextInput
              id="transform-sy"
              className="input-short"
              type="number"
              min={1}
              max={MAX_SCALE}
              value={scaleY}
              onChange={(e) => changeY(+e.target.value)}
            />
            <span className="hint">%</span>
          </div>
          <span className="form-label">Proportions</span>
          <Checkbox label="Keep width and height in step" checked={keep} onChange={setKeep} />
          <span className="form-label">Result</span>
          <span className="mono">
            {result.width} × {result.height} px
          </span>
        </div>
        <DialogNote>
          Positive angles turn clockwise. Rotation uses RotSprite, which keeps lines crisp and adds
          no new colors.{' '}
          {hasSelection
            ? 'The result stays selected, so you can move it before it settles.'
            : 'With nothing selected, the whole layer turns.'}
        </DialogNote>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Apply
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
