import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadAutosave, startAutosave } from '@app/autosave';
import { Documents } from '@app/documents';
import { acceptDroppedFiles, openAnyFile } from '@app/openFile';
import { startPreferences } from '@app/preferences';
import { startUpdates } from '@app/updates';
import { desktop, toFile } from '@platform/desktop';
import { refreshSavedPalettes } from '@platform/palettes';
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
void refreshSavedPalettes();

// Every tab's editor follows the preferences (pixel grid, …).
const docs = new Documents((editor) => startPreferences(editor));

// Reopen the last session's tabs when asked to, and always those with unsaved work.
const saved = getSettings().autosave ? loadAutosave() : { docs: [], active: null };
const restored = saved.docs.filter((d) => getSettings().reopenLast || d.dirty);
if (restored.length) {
  const blank = docs.active().id;
  for (const r of restored) {
    docs.create(r.id).editor.load(r.sprite, {
      palette: r.palette,
      indexed: r.indexed,
      recentColors: r.recentColors,
      fileName: r.fileName,
      dirty: r.dirty,
    });
  }
  docs.close(blank, () => true);
  docs.activate(restored.some((r) => r.id === saved.active) ? saved.active! : restored[0].id);
}
startAutosave(docs);

acceptDroppedFiles(docs);

// Keep the window title on the active tab, and the quit warning on for any
// tab with unsaved changes.
let shown = '';
let watching = new Map<string, () => void>();
const syncTitle = () => {
  const { fileName, dirty } = docs.active().editor.getState();
  const title = `${fileName}${dirty ? ' •' : ''} — Raster`;
  if (title !== shown) {
    shown = title;
    document.title = title;
  }
  desktop?.setDirty(docs.anyDirty());
};
const watchTabs = () => {
  const next = new Map<string, () => void>();
  for (const d of docs.list()) next.set(d.id, watching.get(d.id) ?? d.editor.subscribe(syncTitle));
  for (const [id, stop] of watching) if (!next.has(id)) stop();
  watching = next;
  syncTitle();
};
docs.subscribe(watchTabs);
watchTabs();

// Files opened from Explorer (double-click, "Open with") or a second launch.
desktop?.onOpenFile((file) => openAnyFile(docs, toFile(file)));

// Background update checks (installed app only); messages go to the active tab.
startUpdates((message) => docs.active().editor.notify(message));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App docs={docs} welcome={restored.length === 0} />
  </StrictMode>,
);
