import { parseProject, serializeProject, type Project } from '../core/format';
import type { Editor } from './editor';

const KEY = 'raster:autosave';
const DELAY_MS = 800;

interface Saved {
  fileName: string;
  dirty: boolean;
  project: string;
}

/** Loads the last session's work, if any. Never throws. */
export function loadAutosave(): (Project & { fileName: string; dirty: boolean }) | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved: Saved = JSON.parse(raw);
    return { ...parseProject(saved.project), fileName: saved.fileName, dirty: saved.dirty };
  } catch {
    return null;
  }
}

/**
 * Keeps a copy of the open document in localStorage so a refresh or crash
 * loses nothing. Returns a function that stops autosaving.
 */
export function startAutosave(editor: Editor): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = editor.getState();

  const write = () => {
    const s = editor.getState();
    const saved: Saved = {
      fileName: s.fileName,
      dirty: s.dirty,
      project: serializeProject(editor.project),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // Storage full or unavailable (private mode). Autosave is best effort.
    }
  };

  const unsubscribe = editor.subscribe(() => {
    const s = editor.getState();
    const changed =
      s.revision !== last.revision ||
      s.layers !== last.layers ||
      s.palette !== last.palette ||
      s.indexed !== last.indexed ||
      s.fileName !== last.fileName ||
      s.dirty !== last.dirty;
    last = s;
    if (!changed || editor.stroking) return;
    clearTimeout(timer);
    timer = setTimeout(write, DELAY_MS);
  });

  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
      write();
    }
  };
  window.addEventListener('pagehide', flush);

  return () => {
    flush();
    unsubscribe();
    window.removeEventListener('pagehide', flush);
  };
}
