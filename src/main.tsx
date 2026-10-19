import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadAutosave } from './editor/autosave';
import { desktop, toFile } from './editor/desktop';
import { Editor } from './editor/editor';
import { acceptDroppedFiles, openAnyFile } from './editor/openFile';
import { startUpdates } from './editor/updates';
import { App } from './ui/App';
import './styles.css';

const editor = new Editor();
const restored = loadAutosave();
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
    <App editor={editor} />
  </StrictMode>,
);
