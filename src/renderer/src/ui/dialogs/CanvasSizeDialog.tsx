import { useState } from 'react';
import { clampSpriteSize } from '@core/sprite';
import { Button } from '../components';
import { useEditor } from '../editorContext';
import { Dialog, DialogActions, DialogNote } from './Dialog';
import { SizeFields } from './SizeFields';

const STEPS = [0, 0.5, 1];
const anchorName = (x: number, y: number) =>
  `Anchor ${y === 0 ? 'top' : y === 1 ? 'bottom' : 'middle'} ${x === 0 ? 'left' : x === 1 ? 'right' : 'center'}`;

export function CanvasSizeDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const s = editor.getState();
  const [width, setWidth] = useState(s.width);
  const [height, setHeight] = useState(s.height);
  const [anchor, setAnchor] = useState({ x: 0.5, y: 0.5 });

  const apply = () => {
    editor.resizeCanvas(clampSpriteSize(width), clampSpriteSize(height), anchor.x, anchor.y);
    onClose();
  };

  return (
    <Dialog title="Canvas Size" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="form-grid">
          <SizeFields width={width} height={height} setWidth={setWidth} setHeight={setHeight} />
          <span className="form-label">Anchor</span>
          <div className="anchor-grid">
            {STEPS.flatMap((y) =>
              STEPS.map((x) => (
                <button
                  type="button"
                  key={`${x}-${y}`}
                  aria-label={anchorName(x, y)}
                  aria-pressed={anchor.x === x && anchor.y === y}
                  onClick={() => setAnchor({ x, y })}
                />
              )),
            )}
          </div>
        </div>
        <DialogNote>Shrinking crops pixels outside the new bounds. You can undo this.</DialogNote>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Resize
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
