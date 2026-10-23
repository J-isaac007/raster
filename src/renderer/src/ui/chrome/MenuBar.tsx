import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatKeys, type Action } from '@app/commands';
import { openRecent } from '@app/openFile';
import { refreshRecent } from '@platform/recent';
import { Kbd } from '../components';
import { useEditor, useEditorState } from '../editorContext';
import { useRecentFiles } from '../useSettings';
import { Logo } from './Logo';
import { UpdateBadge } from './UpdateBadge';

/** An action id, a separator, or the recent-files group. */
type MenuEntry = string | '-' | 'recent';

/** How many recent files the File menu lists (the palette and welcome screen show all). */
const MENU_RECENT = 5;

const MENUS: { label: string; items: MenuEntry[] }[] = [
  {
    label: 'File',
    items: [
      'file.new',
      'file.open',
      'file.import',
      '-',
      'recent',
      '-',
      'file.save',
      'file.saveAs',
      '-',
      'file.export',
      '-',
      'file.preferences',
    ],
  },
  {
    label: 'Edit',
    items: [
      'edit.undo',
      'edit.redo',
      '-',
      'edit.cut',
      'edit.copy',
      'edit.paste',
      'edit.delete',
      '-',
      'edit.selectAll',
      'edit.deselect',
      'edit.invertSelection',
      '-',
      'edit.flipH',
      'edit.flipV',
      'edit.rotateCW',
      'edit.rotateCCW',
      'edit.rotate180',
      'edit.transform',
      '-',
      'edit.newBrush',
      'edit.clearBrush',
      '-',
      'edit.clear',
      'edit.swap',
    ],
  },
  {
    label: 'Sprite',
    items: [
      'sprite.scale',
      'sprite.size',
      '-',
      'sprite.rotateCW',
      'sprite.rotateCCW',
      'sprite.rotate180',
      'sprite.flipH',
      'sprite.flipV',
      '-',
      'sprite.crop',
      'sprite.trim',
    ],
  },
  {
    label: 'Layer',
    items: ['layer.new', 'layer.duplicate', 'layer.delete', '-', 'layer.mergeDown'],
  },
  {
    label: 'Frame',
    items: [
      'frame.new',
      'frame.duplicate',
      'frame.duplicateLinked',
      'frame.delete',
      '-',
      'frame.unlink',
      'frame.newTag',
      '-',
      'frame.moveLeft',
      'frame.moveRight',
      '-',
      'frame.prev',
      'frame.next',
      'frame.play',
      '-',
      'frame.onion',
    ],
  },
  {
    label: 'View',
    items: [
      'view.zoomIn',
      'view.zoomOut',
      'view.fit',
      'view.actual',
      '-',
      'view.grid',
      'view.tileGrid',
      'view.tileMode',
      'view.gridSettings',
      '-',
      'view.reference',
      'view.referenceToggle',
      '-',
      'view.mirrorX',
    ],
  },
  {
    label: 'Palette',
    items: ['palette.editColor', 'palette.indexed', '-', 'palette.import', 'palette.export'],
  },
  {
    label: 'Help',
    items: [
      'help.commands',
      'help.shortcuts',
      '-',
      'help.welcome',
      '-',
      'help.updates',
      'help.about',
    ],
  },
];

export function MenuBar({ actions }: { actions: Map<string, Action> }) {
  const [open, setOpen] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const editor = useEditor();
  const recent = useRecentFiles();
  // Everything that affects titles or `enabled` checks; avoids re-rendering on cursor moves.
  const state = useEditorState((s) => ({
    fileName: s.fileName,
    dirty: s.dirty,
    width: s.width,
    height: s.height,
    undoLabel: s.undoLabel,
    redoLabel: s.redoLabel,
    layers: s.layers,
    activeLayerId: s.activeLayerId,
    selection: s.selection,
  }));

  useEffect(() => {
    if (open === null) return;
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Opening and saving change the list, so re-read it whenever File opens.
  useEffect(() => {
    if (open !== null && MENUS[open].items.includes('recent')) void refreshRecent();
  }, [open]);

  const recentItems = () => {
    if (!recent.length) {
      return (
        <button key="recent-none" role="menuitem" className="menu-item" disabled>
          <span>No recent files</span>
        </button>
      );
    }
    const clear = actions.get('file.clearRecent');
    return [
      ...recent.slice(0, MENU_RECENT).map((f, n) => (
        <button
          key={f.path}
          role="menuitem"
          className="menu-item"
          title={f.path}
          onClick={() => {
            setOpen(null);
            void openRecent(editor, f.path, f.name);
          }}
        >
          <span className="menu-recent">
            <span className="menu-recent-index mono">{n + 1}</span>
            {f.name}
          </span>
        </button>
      )),
      clear && (
        <button
          key="recent-clear"
          role="menuitem"
          className="menu-item"
          onClick={() => {
            setOpen(null);
            clear.run();
          }}
        >
          <span>{clear.label}</span>
        </button>
      ),
    ];
  };

  return (
    <header className="menubar" ref={barRef}>
      <div className="brand">
        <Logo size={20} />
        Raster
      </div>
      {MENUS.map((menu, i) => (
        <div className="menu" key={menu.label}>
          <button
            className="menu-trigger"
            aria-haspopup="menu"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            onPointerEnter={() => open !== null && setOpen(i)}
          >
            {menu.label}
          </button>
          {open === i && (
            <div className="menu-list" role="menu">
              {menu.items.map((id, k) => {
                if (id === '-') return <div className="menu-sep" key={k} />;
                if (id === 'recent') return recentItems();
                const action = actions.get(id);
                if (!action) return null;
                return (
                  <button
                    key={id}
                    role="menuitem"
                    className="menu-item"
                    disabled={action.enabled ? !action.enabled(editor.getState()) : false}
                    onClick={() => {
                      setOpen(null);
                      action.run();
                    }}
                  >
                    <span>{action.label}</span>
                    {action.keys?.[0] && (
                      <kbd className="menu-keys">{formatKeys(action.keys[0])}</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="command-search"
        onClick={() => actions.get('help.commands')?.run()}
      >
        <Search size={14} aria-hidden="true" />
        <span>Search commands</span>
        <Kbd>{formatKeys('mod+k')}</Kbd>
      </button>
      <UpdateBadge />
      <div className="doc-title">
        <span className="doc-name">{state.fileName}</span>
        {state.dirty && (
          <span className="dirty" title="Unsaved changes" aria-label="Unsaved changes" />
        )}
        <span className="doc-size mono">
          {state.width} × {state.height}
        </span>
      </div>
    </header>
  );
}
