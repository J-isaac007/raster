import { Fragment } from 'react';
import { formatKeys, type Action } from '@app/commands';
import { Button } from '../components';
import { Dialog, DialogActions } from './Dialog';

const EXTRA_SHORTCUTS: [string, string][] = [
  ['Pan', 'Space + drag, or middle mouse'],
  ['Zoom at cursor', 'Mouse wheel'],
  ['Pick color', 'Alt + click'],
  ['Straight line from last point', 'Shift + click'],
  ['Snap line / square shape', 'Hold Shift'],
  ['Paint with secondary color', 'Right click'],
  ['Move selection', 'Drag inside it (selection tools)'],
  ['Add to / subtract from selection', 'Shift / Ctrl + lasso or wand'],
];

/** Every command with a shortcut, then the mouse gestures. Also shown in Preferences. */
export function ShortcutTable({ actions }: { actions: Action[] }) {
  return (
    <div className="shortcut-table">
      {actions
        .filter((a) => a.keys?.length)
        .map((a) => (
          <Fragment key={a.id}>
            <span>{a.label}</span>
            <kbd>{a.keys!.map(formatKeys).join(' / ')}</kbd>
          </Fragment>
        ))}
      {EXTRA_SHORTCUTS.map(([label, keys]) => (
        <Fragment key={label}>
          <span>{label}</span>
          <kbd>{keys}</kbd>
        </Fragment>
      ))}
    </div>
  );
}

export function ShortcutsDialog({ onClose, actions }: { onClose: () => void; actions: Action[] }) {
  return (
    <Dialog title="Keyboard Shortcuts" onClose={onClose} wide>
      <ShortcutTable actions={actions} />
      <DialogActions>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
