import { FileImage, FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatKeys, type Action } from '@app/commands';
import { newSprite, openRecent } from '@app/openFile';
import { refreshRecent } from '@platform/recent';
import type { RecentFile } from '@shared/settings';
import { Logo } from '../chrome/Logo';
import { Button, Chip, Chips, IconButton, Kbd } from '../components';
import { useEditor } from '../editorContext';
import { useRecentFiles } from '../useSettings';

const SIZES = [16, 32, 64, 128];
const DAY = 24 * 60 * 60 * 1000;

/** "Documents › Sprites": the last two folders of a file's path. */
function folderOf(path: string): string {
  const parts = path.split(/[\\/]/).slice(0, -1);
  return parts.slice(-2).join(' › ');
}

/** "Just now", "12 min ago", "Yesterday", or a short date. */
function when(time: number, now = Date.now()): string {
  const ago = now - time;
  if (ago < 60_000) return 'Just now';
  if (ago < 60 * 60_000) return `${Math.floor(ago / 60_000)} min ago`;
  if (ago < DAY && new Date(time).getDate() === new Date(now).getDate()) {
    return `${Math.floor(ago / (60 * 60_000))} h ago`;
  }
  if (ago < 2 * DAY) return 'Yesterday';
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function RecentRow({ file }: { file: RecentFile }) {
  const editor = useEditor();
  const Icon = file.name.toLowerCase().endsWith('.raster') ? FileText : FileImage;
  return (
    <li>
      <button
        type="button"
        className="recent-row"
        title={file.path}
        onClick={() => void openRecent(editor, file.path, file.name)}
      >
        <Icon size={16} className="recent-icon" aria-hidden="true" />
        <span className="recent-text">
          <span className="recent-name">{file.name}</span>
          <span className="recent-folder">{folderOf(file.path)}</span>
        </span>
        <span className="recent-when mono">{when(file.openedAt)}</span>
      </button>
    </li>
  );
}

/**
 * Shown at startup when there's no sprite to reopen, and from Help › Welcome
 * Screen. Starting or opening a sprite closes it (Figma: Welcome).
 */
export function Welcome({ actions, onClose }: { actions: Map<string, Action>; onClose(): void }) {
  const editor = useEditor();
  const recent = useRecentFiles();
  const [size, setSize] = useState(32);
  const run = (id: string) => actions.get(id)?.run();

  useEffect(() => {
    void refreshRecent();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <main className="welcome">
      <div className="welcome-card">
        <header className="welcome-header">
          <Logo size={40} />
          <div className="welcome-titles">
            <h1>Raster</h1>
            <p>A free, open source pixel art editor</p>
          </div>
          <IconButton icon={X} label="Close" shortcut="Esc" onClick={onClose} />
        </header>

        <div className="welcome-actions">
          <Button variant="primary" onClick={() => newSprite(editor, size, size)}>
            New sprite
          </Button>
          <Button onClick={() => run('file.open')}>Open…</Button>
          <Button variant="ghost" onClick={() => run('file.import')}>
            Import image…
          </Button>
        </div>

        <section className="welcome-section">
          <h2 className="welcome-heading">Start from a size</h2>
          <Chips>
            {SIZES.map((n) => (
              <Chip key={n} pressed={size === n} onClick={() => setSize(n)}>
                {n} × {n}
              </Chip>
            ))}
            <Chip onClick={() => run('file.new')}>Custom…</Chip>
          </Chips>
        </section>

        <section className="welcome-section">
          <h2 className="welcome-heading">Recent</h2>
          {recent.length ? (
            <ul className="recent-list">
              {recent.map((f) => (
                <RecentRow key={f.path} file={f} />
              ))}
            </ul>
          ) : (
            <p className="hint">Sprites you open or save show up here.</p>
          )}
        </section>

        <p className="welcome-tip">
          Tip: press <Kbd>{formatKeys('mod+k')}</Kbd> to find any command. Drop an image anywhere to
          open it.
        </p>
      </div>
    </main>
  );
}
