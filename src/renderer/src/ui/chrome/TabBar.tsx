import { Plus, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { Doc } from '@app/documents';
import { cx, IconButton } from '../components';
import { useDocuments, useTabs } from '../documentsContext';

function Tab({
  doc,
  active,
  onPick,
  onClose,
}: {
  doc: Doc;
  active: boolean;
  onPick(): void;
  onClose(): void;
}) {
  const { editor } = doc;
  const name = useSyncExternalStore(editor.subscribe, () => editor.getState().fileName);
  const dirty = useSyncExternalStore(editor.subscribe, () => editor.getState().dirty);
  return (
    <div
      className={cx('tab', active && 'is-active')}
      role="tab"
      aria-selected={active}
      title={dirty ? `${name} (unsaved changes)` : name}
      onClick={onPick}
      onAuxClick={(e) => {
        if (e.button === 1) onClose();
      }}
      onMouseDown={(e) => {
        // Middle-click closes; keep the browser from starting autoscroll.
        if (e.button === 1) e.preventDefault();
      }}
    >
      <span className="tab-name">{name}</span>
      {dirty && <span className="tab-dirty" aria-label="Unsaved changes" />}
      <IconButton
        icon={X}
        className="tab-close"
        label={`Close ${name}`}
        shortcut="Ctrl+W"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
    </div>
  );
}

/**
 * The open sprites, one tab each (Figma: Tab bar — several sprites). Picking
 * a tab leaves the welcome screen; closing the last one shows it.
 */
export function TabBar({
  onPick,
  onNew,
  onClosedLast,
}: {
  onPick(): void;
  onNew(): void;
  onClosedLast(): void;
}) {
  const docs = useDocuments();
  const { docs: tabs, active } = useTabs();
  const close = (id: string) => {
    const last = docs.list().length === 1;
    if (docs.close(id) && last) onClosedLast();
  };
  return (
    <div className="tab-bar" role="tablist" aria-label="Open sprites">
      {tabs.map((doc) => (
        <Tab
          key={doc.id}
          doc={doc}
          active={doc.id === active.id}
          onPick={() => {
            docs.activate(doc.id);
            onPick();
          }}
          onClose={() => close(doc.id)}
        />
      ))}
      <IconButton
        icon={Plus}
        className="tab-new"
        label="New sprite"
        shortcut="Ctrl+Alt+N"
        onClick={onNew}
      />
    </div>
  );
}
