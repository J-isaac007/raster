import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadAutosave } from '@app/autosave';
import { acceptDroppedFiles, openAnyFile } from '@app/openFile';
import { startPreferences } from '@app/preferences';
import { startUpdates } from '@app/updates';
import { Editor } from '@editor/editor';
import { desktop, toFile } from '@platform/desktop';
import { refreshRecent } from '@platform/recent';
import { getSettings, loadSettings } from '@platform/settings';
import { App } from '@ui/App';
import { applyAccent } from '@ui/theme';
// Bundled so the app looks the same on every machine, offline.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/index.css';

// Preferences come from the main process; everything below depends on them.
await loadSettings();
applyAccent(getSettings().accent);
void refreshRecent();

const editor = new Editor();
startPreferences(editor);

// Reopen the last sprite when asked to, and always when it has unsaved work.
const saved = getSettings().autosave ? loadAutosave() : null;
const restored = saved && (getSettings().reopenLast || saved.dirty) ? saved : null;
if (restored) {
  editor.load(restored.sprite, {
    palette: restored.palette,
    indexed: restored.indexed,
    fileName: restored.fileName,
    dirty: restored.dirty,
  });
}

acceptDroppedFiles(editor);

// Keep the window title and the quit warning in step with the document.
let shown = '';
const syncTitle = () => {
  const { fileName, dirty } = editor.getState();
  const title = `${fileName}${dirty ? ' •' : ''} — Raster`;
  if (title === shown) return;
  shown = title;
  document.title = title;
  desktop?.setDirty(dirty);
};
editor.subscribe(syncTitle);
syncTitle();

// Files opened from Explorer (double-click, "Open with") or a second launch.
desktop?.onOpenFile((file) => openAnyFile(editor, toFile(file)));

// Background update checks (installed app only).
startUpdates(editor);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App editor={editor} welcome={!restored} />
  </StrictMode>,
);
