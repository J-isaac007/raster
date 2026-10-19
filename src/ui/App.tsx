import { useEffect, useMemo, useState } from 'react';
import { createActions, eventCombo, pasteClipboard, type DialogId } from '../editor/actions';
import { EditorContext } from '../editor/context';
import type { Editor } from '../editor/editor';
import { startAutosave } from '../editor/autosave';
import { CanvasView } from './CanvasView';
import { ColorPanel } from './ColorPanel';
import {
  AboutDialog,
  CanvasSizeDialog,
  ExportDialog,
  GridDialog,
  NewSpriteDialog,
  PaletteColorDialog,
  ShortcutsDialog,
  TagDialog,
} from './Dialogs';
import { LayersPanel } from './LayersPanel';
import { MenuBar } from './MenuBar';
import { PalettePanel } from './PalettePanel';
import { ReferencePanel } from './ReferencePanel';
import { StatusBar } from './StatusBar';
import { Timeline } from './Timeline';
import { Toolbar } from './Toolbar';
import { ToolOptions } from './ToolOptions';

/** Actions that keep firing while their key is held. */
const REPEATABLE = new Set([
  'edit.undo',
  'edit.redo',
  'edit.brushUp',
  'edit.brushDown',
  'view.zoomIn',
  'view.zoomOut',
  'frame.prev',
  'frame.next',
]);

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function App({ editor }: { editor: Editor }) {
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const actions = useMemo(() => createActions(editor, setDialog), [editor]);
  const byId = useMemo(() => new Map(actions.map((a) => [a.id, a])), [actions]);

  useEffect(() => {
    const byCombo = new Map<string, (typeof actions)[number]>();
    for (const a of actions) for (const k of a.keys ?? []) byCombo.set(k, a);

    const onKeyDown = (e: KeyboardEvent) => {
      if (dialog || isTyping(e.target)) return;
      if (e.key === ' ') {
        e.preventDefault();
        editor.setPanning(true);
        return;
      }
      const action = byCombo.get(eventCombo(e));
      // Let the browser fire `paste`, which carries the clipboard contents.
      if (!action || action.id === 'edit.paste') return;
      e.preventDefault();
      if (e.repeat && !REPEATABLE.has(action.id)) return;
      if (action.enabled && !action.enabled(editor.getState())) return;
      action.run();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') editor.setPanning(false);
    };
    const onBlur = () => editor.setPanning(false);
    const onPaste = (e: ClipboardEvent) => {
      if (dialog || isTyping(e.target)) return;
      e.preventDefault();
      void pasteClipboard(editor, e.clipboardData);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('paste', onPaste);
    };
  }, [actions, dialog, editor]);

  useEffect(() => startAutosave(editor), [editor]);

  const close = () => setDialog(null);

  return (
    <EditorContext.Provider value={editor}>
      <div className="app">
        <MenuBar actions={byId} />
        <ToolOptions />
        <div className="workspace">
          <Toolbar />
          <CanvasView />
          <aside className="sidebar">
            <ColorPanel />
            <PalettePanel />
            <ReferencePanel />
            <LayersPanel />
          </aside>
        </div>
        <Timeline />
        <StatusBar />
      </div>
      {dialog === 'new' && <NewSpriteDialog onClose={close} />}
      {dialog === 'export' && <ExportDialog onClose={close} />}
      {dialog === 'canvasSize' && <CanvasSizeDialog onClose={close} />}
      {dialog === 'grid' && <GridDialog onClose={close} />}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={close} actions={actions} />}
      {dialog === 'about' && <AboutDialog onClose={close} />}
      {dialog === 'tag' && <TagDialog index={null} onClose={close} />}
      {dialog === 'paletteColor' && (
        <PaletteColorDialog
          index={editor.getState().palette.indexOf(editor.getState().primary)}
          onClose={close}
        />
      )}
    </EditorContext.Provider>
  );
}
