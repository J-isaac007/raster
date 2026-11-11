import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createActions, eventCombo, pasteClipboard, type DialogId } from '@app/commands';
import type { Documents } from '@app/documents';
import { getSettings, subscribeSettings } from '@platform/settings';
import { CanvasView } from './canvas/CanvasView';
import { MenuBar } from './chrome/MenuBar';
import { StatusBar } from './chrome/StatusBar';
import { Toast } from './chrome/Toast';
import { Toolbar } from './chrome/Toolbar';
import { TabBar } from './chrome/TabBar';
import { ToolOptions } from './chrome/ToolOptions';
import { TooltipLayer } from './components';
import {
  AboutDialog,
  CanvasSizeDialog,
  CelPropertiesDialog,
  DropShadowDialog,
  ExportDialog,
  GridDialog,
  HueSaturationDialog,
  NewSpriteDialog,
  OutlineDialog,
  PaletteBrowserDialog,
  PaletteColorDialog,
  PreferencesDialog,
  RampDialog,
  ReplaceColorDialog,
  ShortcutsDialog,
  SpriteSizeDialog,
  TagDialog,
} from './dialogs';
import { DocumentsContext } from './documentsContext';
import { EditorContext } from './editorContext';
import { ColorPanel } from './panels/ColorPanel';
import { LayersPanel } from './panels/LayersPanel';
import { PalettePanel } from './panels/PalettePanel';
import { ReferencePanel } from './panels/ReferencePanel';
import { Timeline } from './timeline/Timeline';
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

export function App({ docs, welcome: startOnWelcome }: { docs: Documents; welcome: boolean }) {
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const [welcome, setWelcome] = useState(startOnWelcome);
  const { active } = useSyncExternalStore(docs.subscribe, docs.getSnapshot);
  const editor = active.editor;
  const openDialog = useCallback((id: DialogId) => {
    if (id === 'welcome') setWelcome(true);
    else setDialog(id);
  }, []);
  // Rebuilt for each tab: actions act on the active tab's editor.
  const actions = useMemo(
    () => createActions(docs, editor, openDialog),
    [docs, editor, openDialog],
  );
  const byId = useMemo(() => new Map(actions.map((a) => [a.id, a])), [actions]);

  useEffect(() => {
    // A key can serve several actions (Enter applies a transform, else plays);
    // the first one enabled runs.
    const byCombo = new Map<string, (typeof actions)[number][]>();
    for (const a of actions) {
      for (const k of a.keys ?? []) byCombo.set(k, [...(byCombo.get(k) ?? []), a]);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (dialog || isTyping(e.target)) return;
      if (e.key === ' ') {
        e.preventDefault();
        editor.setPanning(true);
        return;
      }
      const candidates = byCombo.get(eventCombo(e));
      // Let the browser fire `paste`, which carries the clipboard contents.
      if (!candidates || candidates[0].id === 'edit.paste') return;
      e.preventDefault();
      const s = editor.getState();
      const action = candidates.find((a) => !a.enabled || a.enabled(s));
      if (!action) return;
      if (e.repeat && !REPEATABLE.has(action.id)) return;
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

  // Starting or opening a sprite leaves the welcome screen, and so does
  // applying a palette (e.g. one dropped on the window), so its result shows.
  // (Switching tabs only resets what's watched; the tab bar leaves the welcome
  // screen itself when a tab is picked.)
  const documentId = useSyncExternalStore(editor.subscribe, () => editor.getState().documentId);
  const palette = useSyncExternalStore(editor.subscribe, () => editor.getState().palette);
  const shown = useRef({ editor, documentId, palette });
  useEffect(() => {
    const was = shown.current;
    shown.current = { editor, documentId, palette };
    if (was.editor !== editor) return;
    if (documentId === was.documentId && palette === was.palette) return;
    setWelcome(false);
  }, [editor, documentId, palette]);

  const { accent } = useSyncExternalStore(subscribeSettings, getSettings);
  useEffect(() => applyAccent(accent), [accent]);
  const closeWelcome = useCallback(() => setWelcome(false), []);

  const close = () => setDialog(null);

  return (
    <DocumentsContext.Provider value={docs}>
      <EditorContext.Provider value={editor}>
        <div className={welcome ? 'app is-welcome' : 'app'}>
          <MenuBar actions={byId} />
          <TabBar
            onPick={closeWelcome}
            onNew={() => openDialog('new')}
            onClosedLast={() => setWelcome(true)}
          />
          {welcome ? (
            <Welcome actions={byId} onClose={closeWelcome} />
          ) : (
            <>
              <ToolOptions />
              <div className="workspace" key={active.id}>
                <Toolbar />
                <div className="stage">
                  <CanvasView />
                  <Toast />
                </div>
                <aside className="sidebar">
                  <ColorPanel />
                  <PalettePanel onBrowse={() => openDialog('palettes')} />
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
        {dialog === 'grid' && <GridDialog onClose={close} />}
        {dialog === 'shortcuts' && <ShortcutsDialog onClose={close} actions={actions} />}
        {dialog === 'about' && <AboutDialog onClose={close} />}
        {dialog === 'preferences' && <PreferencesDialog onClose={close} actions={actions} />}
        {dialog === 'commands' && <CommandPalette onClose={close} actions={actions} />}
        {dialog === 'tag' && <TagDialog index={null} onClose={close} />}
        {dialog === 'palettes' && <PaletteBrowserDialog onClose={close} />}
        {dialog === 'savePalette' && <PaletteBrowserDialog onClose={close} save />}
        {dialog === 'ramp' && <RampDialog onClose={close} />}
        {dialog === 'hueSaturation' && <HueSaturationDialog onClose={close} />}
        {dialog === 'replaceColor' && <ReplaceColorDialog onClose={close} />}
        {dialog === 'outline' && <OutlineDialog onClose={close} />}
        {dialog === 'dropShadow' && <DropShadowDialog onClose={close} />}
        {dialog === 'celProperties' && <CelPropertiesDialog onClose={close} />}
        {dialog === 'paletteColor' && (
          <PaletteColorDialog
            index={editor.getState().palette.indexOf(editor.getState().primary)}
            onClose={close}
          />
        )}
      </EditorContext.Provider>
    </DocumentsContext.Provider>
  );
}
