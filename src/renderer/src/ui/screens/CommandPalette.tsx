import { Search } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { searchItems } from '@app/commandSearch';
import { formatKeys, type Action } from '@app/commands';
import { openRecent } from '@app/openFile';
import { refreshRecent } from '@platform/recent';
import { cx, Kbd } from '../components';
import { useEditor } from '../editorContext';
import { useRecentFiles } from '../useSettings';

interface Item {
  id: string;
  label: string;
  group: string;
  keys?: string;
  enabled: boolean;
  run(): void;
}

const GROUPS: Record<string, string> = {
  file: 'File',
  edit: 'Edit',
  sprite: 'Sprite',
  layer: 'Layer',
  frame: 'Frame',
  view: 'View',
  palette: 'Palette',
  help: 'Help',
  tool: 'Tools',
};

const RECENT_KEY = 'raster.palette.recent';
const MAX_RECENT_COMMANDS = 5;

function readRecentCommands(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function rememberCommand(id: string): void {
  try {
    const list = [id, ...readRecentCommands().filter((x) => x !== id)].slice(
      0,
      MAX_RECENT_COMMANDS,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Not remembered; fine.
  }
}

/** Find and run any command, or open a recent file, by typing (Figma: Command palette). */
export function CommandPalette({ actions, onClose }: { actions: Action[]; onClose(): void }) {
  const editor = useEditor();
  const recentFiles = useRecentFiles();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refreshRecent();
  }, []);

  const items = useMemo<Item[]>(() => {
    const state = editor.getState();
    const commands = actions
      .filter((a) => a.id !== 'help.commands')
      .map((a) => ({
        id: a.id,
        label: a.label,
        group: GROUPS[a.id.split('.')[0]] ?? 'Other',
        keys: a.keys?.[0] && formatKeys(a.keys[0]),
        enabled: a.enabled ? a.enabled(state) : true,
        run: a.run,
      }));
    const files = recentFiles.map((f) => ({
      id: `recent:${f.path}`,
      label: `Open ${f.name}`,
      group: 'Recent files',
      enabled: true,
      run: () => void openRecent(editor, f.path, f.name),
    }));
    return [...commands, ...files];
  }, [actions, editor, recentFiles]);

  // With no query: recently run commands, then everything in menu order.
  const sections = useMemo<{ title?: string; items: Item[] }[]>(() => {
    if (query.trim()) {
      return [{ items: searchItems(items, query, (i) => `${i.label} ${i.group}`) }];
    }
    const byId = new Map(items.map((i) => [i.id, i]));
    const recent = readRecentCommands()
      .map((id) => byId.get(id))
      .filter((i): i is Item => !!i);
    return [
      ...(recent.length ? [{ title: 'Recently used', items: recent }] : []),
      { title: 'All commands', items: items.filter((i) => !i.id.startsWith('recent:')) },
    ];
  }, [items, query]);
  const flat = sections.flatMap((s) => s.items);
  const selected = Math.min(index, Math.max(0, flat.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const runItem = (item: Item | undefined) => {
    if (!item?.enabled) return;
    onClose();
    if (!item.id.startsWith('recent:')) rememberCommand(item.id);
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setIndex((selected + step + flat.length) % Math.max(1, flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runItem(flat[selected]);
    }
  };

  let n = 0;
  return (
    <div
      className="backdrop commands-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="commands"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
      >
        <div className="commands-search">
          <Search size={16} aria-hidden="true" />
          <input
            autoFocus
            className="commands-input"
            placeholder="Type a command or a file name"
            aria-label="Search commands"
            aria-controls="commands-results"
            aria-activedescendant={flat.length ? `commands-item-${selected}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="commands-results" id="commands-results" role="listbox" ref={listRef}>
          {flat.length === 0 && <p className="commands-empty">No commands match “{query}”</p>}
          {sections.map((section, s) => (
            <Fragment key={section.title ?? s}>
              {section.title && <div className="commands-group">{section.title}</div>}
              {section.items.map((item) => {
                const i = n++;
                return (
                  <div
                    key={`${section.title}-${item.id}`}
                    id={`commands-item-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === selected}
                    aria-disabled={!item.enabled}
                    className={cx('commands-item', !item.enabled && 'is-disabled')}
                    onPointerMove={() => i !== selected && setIndex(i)}
                    onClick={() => runItem(item)}
                  >
                    <span className="commands-label">{item.label}</span>
                    <span className="commands-where">{item.group}</span>
                    {item.keys && <kbd className="menu-keys">{item.keys}</kbd>}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
        <footer className="commands-footer">
          <span>↑ ↓ to move</span>
          <span>Enter to run</span>
          <span>Esc to close</span>
        </footer>
      </div>
    </div>
  );
}
