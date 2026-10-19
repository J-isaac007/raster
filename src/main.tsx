import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadAutosave } from './editor/autosave';
import { Editor } from './editor/editor';
import { acceptDroppedFiles, openAnyFile } from './editor/openFile';
import { handleLaunchFiles, registerServiceWorker, trackInstall } from './editor/pwa';
import { App } from './ui/App';
import './styles.css';

const editor = new Editor();
const restored = loadAutosave();
if (restored) {
  editor.load(restored.sprite, {
    palette: restored.palette,
    fileName: restored.fileName,
    dirty: restored.dirty,
  });
}

acceptDroppedFiles(editor);
handleLaunchFiles((file) => openAnyFile(editor, file));
trackInstall();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App editor={editor} />
  </StrictMode>,
);
