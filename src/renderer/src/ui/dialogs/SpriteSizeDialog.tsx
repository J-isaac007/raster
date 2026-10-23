import { useState } from 'react';
import { clampSpriteSize } from '@core/sprite';
import { Button, Checkbox, Chip, Chips } from '../components';
import { useEditor } from '../editorContext';
import { Dialog, DialogActions, DialogNote } from './Dialog';
import { SizeFields } from './SizeFields';

const FACTORS = [0.5, 2, 3, 4];

/** Scales the whole sprite (nearest neighbor), unlike Canvas Size, which crops or pads. */
export function SpriteSizeDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const s = editor.getState();
  const [width, setWidth] = useState(s.width);
  const [height, setHeight] = useState(s.height);
  const [keep, setKeep] = useState(true);
  const ratio = s.height / s.width;

  const changeWidth = (n: number) => {
    setWidth(n);
    if (keep) setHeight(clampSpriteSize(n * ratio));
  };
  const changeHeight = (n: number) => {
    setHeight(n);
    if (keep) setWidth(clampSpriteSize(n / ratio));
  };
  const scaleBy = (factor: number) => {
    setWidth(clampSpriteSize(s.width * factor));
    setHeight(clampSpriteSize(s.height * factor));
  };

  const apply = () => {
    editor.scaleSprite(clampSpriteSize(width), clampSpriteSize(height));
    onClose();
  };

  return (
    <Dialog title="Sprite Size" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="form-grid">
          <SizeFields
            width={width}
            height={height}
            setWidth={changeWidth}
            setHeight={changeHeight}
          />
          <span className="form-label">Proportions</span>
          <Checkbox label="Keep width and height in step" checked={keep} onChange={setKeep} />
          <span className="form-label">Scale</span>
          <Chips>
            {FACTORS.map((f) => (
              <Chip
                key={f}
                pressed={
                  width === clampSpriteSize(s.width * f) && height === clampSpriteSize(s.height * f)
                }
                onClick={() => scaleBy(f)}
              >
                {f * 100}%
              </Chip>
            ))}
          </Chips>
        </div>
        <DialogNote>
          Scales every layer and frame. Pixels are repeated or dropped, never blurred, so whole
          multiples like 200% look best. You can undo this.
        </DialogNote>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Scale
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
