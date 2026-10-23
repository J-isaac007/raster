import { useState } from 'react';
import type { TileMode } from '@editor/editor';
import { Button, Checkbox, Chip, Chips, TextInput } from '../components';
import { useEditor, useEditorState } from '../editorContext';
import { Dialog, DialogActions, DialogNote } from './Dialog';

const TILE_MODES: [TileMode, string][] = [
  ['off', 'Off'],
  ['both', 'Both'],
  ['x', 'Horizontal'],
  ['y', 'Vertical'],
];

export function GridDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const s = useEditorState((s) => ({
    showGrid: s.showGrid,
    showTileGrid: s.showTileGrid,
    tileGrid: s.tileGrid,
    tileMode: s.tileMode,
  }));
  const [width, setWidth] = useState(s.tileGrid.width);
  const [height, setHeight] = useState(s.tileGrid.height);

  return (
    <Dialog title="Grid & Tiles" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          editor.setTileGrid(width, height);
          onClose();
        }}
      >
        <div className="form-grid">
          <span className="form-label">Pixel grid</span>
          <Checkbox
            label="Show when zoomed in"
            checked={s.showGrid}
            onChange={(showGrid) => editor.setOption({ showGrid })}
          />
          <span className="form-label">Tile grid</span>
          <Checkbox
            label="Show"
            checked={s.showTileGrid}
            onChange={(showTileGrid) => editor.setOption({ showTileGrid })}
          />
          <label htmlFor="tile-w">Tile width</label>
          <TextInput
            id="tile-w"
            type="number"
            min={1}
            max={1024}
            value={width}
            onChange={(e) => setWidth(+e.target.value)}
          />
          <label htmlFor="tile-h">Tile height</label>
          <TextInput
            id="tile-h"
            type="number"
            min={1}
            max={1024}
            value={height}
            onChange={(e) => setHeight(+e.target.value)}
          />
          <span className="form-label">Tile mode</span>
          <Chips>
            {TILE_MODES.map(([mode, label]) => (
              <Chip
                key={mode}
                pressed={s.tileMode === mode}
                onClick={() => editor.setOption({ tileMode: mode })}
              >
                {label}
              </Chip>
            ))}
          </Chips>
        </div>
        <DialogNote>
          Tile mode repeats the sprite around the canvas and wraps strokes across its edges, so you
          can paint seamless textures.
        </DialogNote>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Done
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
