import { parseProject, serializeProject, type Project } from '@core/format';
import type { Editor } from '@editor/editor';
import { getSettings } from '@platform/settings';
import type { Documents } from './documents';

/** One key per open document, plus an index with the tab order. */
const PREFIX = 'raster:autosave:doc:';
const INDEX = 'raster:autosave:docs';
/** Before tabs, a single document lived here. */
const LEGACY = 'raster:autosave';
const DELAY_MS = 800;

interface Saved {
  fileName: string;
  dirty: boolean;
  project: string;
}

interface Index {
  ids: string[];
  active: string | null;
}

export interface RestoredDoc extends Project {
  id: string;
  fileName: string;
  dirty: boolean;
}

/** Storage that may be missing or full; every call is best effort. */
export interface AutosaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const browserStorage = (): AutosaveStorage | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

const readSaved = (raw: string | null, id: string): RestoredDoc | null => {
  if (!raw) return null;
  try {
    const saved: Saved = JSON.parse(raw);
    return { ...parseProject(saved.project), id, fileName: saved.fileName, dirty: saved.dirty };
  } catch {
    return null;
  }
};

/** Loads the last session's documents in tab order, and which one was active. Never throws. */
export function loadAutosave(storage = browserStorage()): {
  docs: RestoredDoc[];
  active: string | null;
} {
  if (!storage) return { docs: [], active: null };
  try {
    const index: Index | null = JSON.parse(storage.getItem(INDEX) ?? 'null');
    if (index && Array.isArray(index.ids)) {
      const docs = index.ids
        .map((id) => readSaved(storage.getItem(PREFIX + id), id))
        .filter((d): d is RestoredDoc => d !== null);
      return { docs, active: index.active };
    }
    const legacy = readSaved(storage.getItem(LEGACY), 'restored');
    return { docs: legacy ? [legacy] : [], active: legacy?.id ?? null };
  } catch {
    return { docs: [], active: null };
  }
}

/** Forgets every saved copy (autosave was turned off). */
export function clearAutosave(storage = browserStorage()): void {
  if (!storage) return;
  try {
    const index: Index | null = JSON.parse(storage.getItem(INDEX) ?? 'null');
    index?.ids.forEach((id) => storage.removeItem(PREFIX + id));
    storage.removeItem(INDEX);
    storage.removeItem(LEGACY);
  } catch {
    // Nothing stored.
  }
}

/** True for changes worth saving (not view changes like zoom or the tool). */
function changedDocument(a: ReturnType<Editor['getState']>, b: ReturnType<Editor['getState']>) {
  return (
    a.revision !== b.revision ||
    a.layers !== b.layers ||
    a.groups !== b.groups ||
    a.frames !== b.frames ||
    a.tags !== b.tags ||
    a.palette !== b.palette ||
    a.indexed !== b.indexed ||
    a.recentColors !== b.recentColors ||
    a.fileName !== b.fileName ||
    a.dirty !== b.dirty
  );
}

/**
 * Keeps a copy of every open document in localStorage so a refresh or crash
 * loses nothing, while the Autosave preference is on. Closed tabs are
 * forgotten. If storage fills up, documents with unsaved changes are kept
 * first. Returns a function that stops autosaving.
 */
export function startAutosave(docs: Documents, storage = browserStorage()): () => void {
  if (!storage) return () => {};
  const watched = new Map<string, { stop: () => void; flush: () => void }>();

  const writeIndex = () => {
    if (!getSettings().autosave) return;
    const index: Index = { ids: docs.list().map((d) => d.id), active: docs.active().id };
    try {
      storage.setItem(INDEX, JSON.stringify(index));
    } catch {
      // Storage unavailable.
    }
  };

  const write = (id: string, editor: Editor) => {
    if (!getSettings().autosave) return;
    const s = editor.getState();
    const saved: Saved = {
      fileName: s.fileName,
      dirty: s.dirty,
      project: serializeProject(editor.project),
    };
    const value = JSON.stringify(saved);
    try {
      storage.setItem(PREFIX + id, value);
    } catch {
      // Full: drop the saved copies of tabs with no unsaved changes, then retry.
      for (const d of docs.list()) {
        if (d.id !== id && !d.editor.getState().dirty) storage.removeItem(PREFIX + d.id);
      }
      try {
        storage.setItem(PREFIX + id, value);
      } catch {
        editor.notify('Autosave is out of room; save your work');
      }
    }
  };

  const watch = (id: string, editor: Editor) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = editor.getState();
    const unsubscribe = editor.subscribe(() => {
      const s = editor.getState();
      const changed = changedDocument(s, last);
      last = s;
      if (!changed || editor.stroking) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        write(id, editor);
      }, DELAY_MS);
    });
    const flush = () => {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      write(id, editor);
    };
    write(id, editor);
    watched.set(id, { stop: () => (clearTimeout(timer), unsubscribe()), flush });
  };

  const sync = () => {
    const ids = new Set(docs.list().map((d) => d.id));
    for (const [id, w] of watched) {
      if (ids.has(id)) continue;
      w.stop();
      watched.delete(id);
      try {
        storage.removeItem(PREFIX + id);
      } catch {
        // Nothing stored.
      }
    }
    for (const d of docs.list()) if (!watched.has(d.id)) watch(d.id, d.editor);
    writeIndex();
  };

  sync();
  const unsubscribe = docs.subscribe(sync);
  const flushAll = () => watched.forEach((w) => w.flush());
  const win = typeof window === 'undefined' ? null : window;
  win?.addEventListener('pagehide', flushAll);

  return () => {
    flushAll();
    unsubscribe();
    watched.forEach((w) => w.stop());
    win?.removeEventListener('pagehide', flushAll);
  };
}
