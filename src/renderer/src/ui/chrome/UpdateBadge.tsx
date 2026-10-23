import { Download } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { getUpdateStatus, installUpdate, subscribeUpdates } from '@app/updates';

/** Shows in the menu bar once an update has downloaded; click to restart into it. */
export function UpdateBadge() {
  const status = useSyncExternalStore(subscribeUpdates, getUpdateStatus);
  if (status.status !== 'ready') return null;
  return (
    <button
      className="update-badge"
      title={`Raster ${status.version} has downloaded. Restart to install it; your work is autosaved.`}
      onClick={installUpdate}
    >
      <Download size={13} aria-hidden="true" />
      Restart to update to {status.version}
    </button>
  );
}
