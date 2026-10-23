import { useState } from 'react';
import { newSprite } from '@app/openFile';
import { Button, Chip, Chips } from '../components';
import { useEditor } from '../editorContext';
import { Dialog, DialogActions } from './Dialog';
import { SizeFields } from './SizeFields';

const SIZE_PRESETS = [16, 32, 48, 64, 128, 256];

export function NewSpriteDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);

  const create = () => {
    if (newSprite(editor, width, height)) onClose();
  };

  return (
    <Dialog title="New Sprite" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <div className="form-grid">
          <SizeFields width={width} height={height} setWidth={setWidth} setHeight={setHeight} />
          <span className="form-label">Presets</span>
          <Chips>
            {SIZE_PRESETS.map((n) => (
              <Chip
                key={n}
                pressed={width === n && height === n}
                onClick={() => {
                  setWidth(n);
                  setHeight(n);
                }}
              >
                {n}²
              </Chip>
            ))}
          </Chips>
        </div>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Create
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
