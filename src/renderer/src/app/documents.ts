import { Editor } from '@editor/editor';
import { newFileRef, type FileRef } from '@platform/files';

/** One open sprite: a tab. */
export interface Doc {
  /** Stable for the document's life, and across restarts (autosave keys it). */
  id: string;
  editor: Editor;
  /** Where it was opened from or saved to. */
  file: FileRef;
}

let counter = 0;
const newDocId = () =>
  `doc-${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** True for a fresh, untouched untitled sprite: opening a file can reuse its tab. */
export function isPristine(doc: Doc): boolean {
  const s = doc.editor.getState();
  return (
    !s.dirty && !s.undoLabel && s.fileName === 'untitled' && !doc.file.path && !doc.file.handle
  );
}

/**
 * The open documents (tabs) and which one is active. There is always at least
 * one. `setup` runs for every new editor (preferences, …) and returns a
 * function that undoes it when the tab closes.
 */
export class Documents {
  private docs: Doc[] = [];
  private activeId = '';
  private readonly listeners = new Set<() => void>();
  private readonly teardown = new Map<string, () => void>();
  private snapshot: { docs: readonly Doc[]; active: Doc } | null = null;

  constructor(private readonly setup: (editor: Editor) => () => void = () => () => {}) {
    this.create();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit(): void {
    this.snapshot = null;
    this.listeners.forEach((fn) => fn());
  }

  /** The tabs in order and the active one; the same object until something changes. */
  getSnapshot = (): { docs: readonly Doc[]; active: Doc } => {
    this.snapshot ??= { docs: [...this.docs], active: this.active() };
    return this.snapshot;
  };

  list(): readonly Doc[] {
    return this.docs;
  }

  active(): Doc {
    return this.docs.find((d) => d.id === this.activeId) ?? this.docs[0];
  }

  get(id: string): Doc | undefined {
    return this.docs.find((d) => d.id === id);
  }

  /** Adds an empty untitled tab after the active one and switches to it. */
  create(id = newDocId(), file: FileRef = newFileRef()): Doc {
    const doc: Doc = { id, editor: new Editor(), file };
    this.teardown.set(id, this.setup(doc.editor));
    const at = this.docs.indexOf(this.active());
    this.docs.splice(at < 0 ? this.docs.length : at + 1, 0, doc);
    this.activeId = id;
    this.emit();
    return doc;
  }

  /**
   * Opens something into a tab: the active one if it's an untouched untitled
   * sprite, else a new one. `load` fills the tab's editor.
   */
  open(load: (editor: Editor) => void, file: FileRef = newFileRef()): Doc {
    const current = this.active();
    const doc = current && isPristine(current) ? current : this.create();
    doc.file = file;
    load(doc.editor);
    this.activeId = doc.id;
    this.emit();
    return doc;
  }

  activate(id: string): void {
    if (id === this.activeId || !this.get(id)) return;
    this.active().editor.settle();
    this.activeId = id;
    this.emit();
  }

  /** Switches to the next (+1) or previous (-1) tab, wrapping around. */
  cycle(step: 1 | -1): void {
    const i = this.docs.indexOf(this.active());
    const n = this.docs.length;
    this.activate(this.docs[(i + step + n) % n].id);
  }

  /**
   * Closes a tab, asking first if it has unsaved changes. Closing the last tab
   * leaves a fresh untitled one. Returns false if the user kept it open.
   */
  close(id: string, confirm: (message: string) => boolean = (m) => window.confirm(m)): boolean {
    const doc = this.get(id);
    if (!doc) return false;
    const { dirty, fileName } = doc.editor.getState();
    if (dirty && !confirm(`Close ${fileName} without saving your changes?`)) return false;
    const i = this.docs.indexOf(doc);
    this.docs.splice(i, 1);
    this.teardown.get(id)?.();
    this.teardown.delete(id);
    if (this.docs.length === 0) {
      this.create();
      return true;
    }
    if (this.activeId === id) this.activeId = this.docs[Math.min(i, this.docs.length - 1)].id;
    this.emit();
    return true;
  }

  /** Closes every tab but `id`; stops at the first one the user keeps. */
  closeOthers(id: string, confirm?: (message: string) => boolean): void {
    for (const doc of [...this.docs]) {
      if (doc.id !== id && !this.close(doc.id, confirm)) return;
    }
    this.activate(id);
  }

  /** True if any tab has unsaved changes. */
  anyDirty(): boolean {
    return this.docs.some((d) => d.editor.getState().dirty);
  }

  /** Puts tabs in the order of `ids` (restoring a session), keeping any others after. */
  reorder(ids: string[]): void {
    const rank = (d: Doc) => {
      const r = ids.indexOf(d.id);
      return r < 0 ? ids.length : r;
    };
    this.docs.sort((a, b) => rank(a) - rank(b));
    this.emit();
  }
}
