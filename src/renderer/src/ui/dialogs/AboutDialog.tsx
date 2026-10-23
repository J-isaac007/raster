import { useSyncExternalStore } from 'react';
import {
  checkForUpdates,
  describeUpdate,
  getUpdateStatus,
  installUpdate,
  subscribeUpdates,
} from '@app/updates';
import { updateSettings } from '@platform/settings';
import { Logo } from '../chrome/Logo';
import { Button, Checkbox } from '../components';
import { useEditor } from '../editorContext';
import { useSettings } from '../useSettings';
import { Dialog, DialogActions } from './Dialog';

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const update = useSyncExternalStore(subscribeUpdates, getUpdateStatus);
  const { checkUpdates } = useSettings();
  const note =
    update.status === 'idle' || update.status === 'checking' ? null : describeUpdate(update);
  return (
    <Dialog title="About Raster" onClose={onClose}>
      <div className="about-logo">
        <Logo size={80} />
      </div>
      <p>
        <strong>Raster</strong> {__APP_VERSION__} — a free, open source pixel art editor.
      </p>
      <p>Released under the MIT License. Contributions are welcome.</p>
      <div className="about-updates">
        <Checkbox
          label="Check for updates when Raster starts"
          checked={checkUpdates}
          onChange={(on) => updateSettings({ checkUpdates: on })}
        />
        {note && <p className="hint">{note}</p>}
      </div>
      <DialogActions>
        {update.status === 'ready' ? (
          <Button onClick={installUpdate}>Restart to update</Button>
        ) : (
          <Button
            disabled={update.status === 'checking' || update.status === 'downloading'}
            onClick={() => checkForUpdates(editor)}
          >
            Check for updates
          </Button>
        )}
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
