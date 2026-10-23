import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { startAutosave } from '@app/autosave';
import { createActions, eventCombo, pasteClipboard, type DialogId } from '@app/commands';
import type { Editor } from '@editor/editor';
import { getSettings, subscribeSettings } from '@platform/settings';
import { CanvasView } from './canvas/CanvasView';
import { MenuBar } from './chrome/MenuBar';
import { StatusBar } from './chrome/StatusBar';
import { Toast } from './chrome/Toast';
import { Toolbar } from './chrome/Toolbar';
import { ToolOptions } from './chrome/ToolOptions';
import { TooltipLayer } from './components';
import {
  AboutDialog,
  CanvasSizeDialog,
  ExportDialog,
  GridDialog,
  NewSpriteDialog,
  PaletteColorDialog,
  PreferencesDialog,
  ShortcutsDialog,
  SpriteSizeDialog,
  TagDialog,
  TransformDialog,
} from './dialogs';
import { EditorContext } from './editorContext';
import { ColorPanel } from './panels/ColorPanel';
import { LayersPanel } from './panels/LayersPanel';
import { PalettePanel } from './panels/PalettePanel';
import { ReferencePanel } from './panels/ReferencePanel';
import { Timeline } from './panels/Timeline';
import { CommandPalette } from './screens/CommandPalette';
import { Welcome } from './screens/Welcome';
import { applyAccent } from './theme';

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

export function App({ editor, welcome: startOnWelcome }: { editor: Editor; welcome: boolean }) {
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const [welcome, setWelcome] = useState(startOnWelcome);
  const openDialog = useCallback((id: DialogId) => {
    if (id === 'welcome') setWelcome(true);
    else setDialog(id);
  }, []);
  const actions = useMemo(() => createActions(editor, openDialog), [editor, openDialog]);
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

  // Starting or opening a sprite leaves the welcome screen.
  const documentId = useSyncExternalStore(editor.subscribe, () => editor.getState().documentId);
  const shownDocument = useRef(documentId);
  useEffect(() => {
    if (documentId === shownDocument.current) return;
    shownDocument.current = documentId;
    setWelcome(false);
  }, [documentId]);

  const { accent } = useSyncExternalStore(subscribeSettings, getSettings);
  useEffect(() => applyAccent(accent), [accent]);
  const closeWelcome = useCallback(() => setWelcome(false), []);

  const close = () => setDialog(null);

  return (
    <EditorContext.Provider value={editor}>
      <div className={welcome ? 'app is-welcome' : 'app'}>
        <MenuBar actions={byId} />
        {welcome ? (
          <Welcome actions={byId} onClose={closeWelcome} />
        ) : (
          <>
            <ToolOptions />
            <div className="workspace">
              <Toolbar />
              <div className="stage">
                <CanvasView />
                <Toast />
              </div>
              <aside className="sidebar">
                <ColorPanel />
                <PalettePanel />
                <ReferencePanel />
                <LayersPanel />
              </aside>
            </div>
            <Timeline />
            <StatusBar />
          </>
        )}
      </div>
      <TooltipLayer />
      {dialog === 'new' && <NewSpriteDialog onClose={close} />}
      {dialog === 'export' && <ExportDialog onClose={close} />}
      {dialog === 'canvasSize' && <CanvasSizeDialog onClose={close} />}
      {dialog === 'spriteSize' && <SpriteSizeDialog onClose={close} />}
      {dialog === 'transform' && <TransformDialog onClose={close} />}
      {dialog === 'grid' && <GridDialog onClose={close} />}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={close} actions={actions} />}
      {dialog === 'about' && <AboutDialog onClose={close} />}
      {dialog === 'preferences' && <PreferencesDialog onClose={close} actions={actions} />}
      {dialog === 'commands' && <CommandPalette onClose={close} actions={actions} />}
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
