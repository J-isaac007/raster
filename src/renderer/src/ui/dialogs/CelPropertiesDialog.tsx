import { useState } from 'react';
import { Button, Slider } from '../components';
import { useEditor } from '../editorContext';
import { Dialog, DialogActions, DialogNote } from './Dialog';

/**
 * Cel properties for the cels picked in the timeline (or the active cel):
 * opacity, on top of the layer's own opacity. Changes show at once.
 */
export function CelPropertiesDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const s = editor.getState();
  const sel = s.timelineSelection;
  const layerIds = sel && sel.layerIds.length ? sel.layerIds : [s.activeLayerId];
  const [lo, hi] = sel && sel.layerIds.length ? sel.frames : [s.frame, s.frame];
  const frames = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const count = layerIds.length * frames.length;
  const [opacity, setOpacity] = useState(() =>
    Math.round(editor.celOpacity(layerIds[0], lo) * 100),
  );

  return (
    <Dialog title="Cel Properties" onClose={onClose}>
      <Slider
        label="Opacity"
        min={0}
        max={100}
        value={opacity}
        display={`${opacity}%`}
        onChange={(v) => {
          setOpacity(v);
          editor.setCelOpacity(layerIds, frames, v / 100);
        }}
        onCommit={() => editor.sealHistory()}
      />
      <DialogNote>
        {count > 1 ? `Applies to ${count} cels. ` : ''}A cel&apos;s opacity multiplies its
        layer&apos;s opacity. Linked cels share it.
      </DialogNote>
      <DialogActions>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
