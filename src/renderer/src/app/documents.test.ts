import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSprite } from '@core/sprite';
import { newFileRef } from '@platform/files';
import { loadAutosave, startAutosave, type AutosaveStorage } from './autosave';
import { Documents, isPristine } from './documents';
import { newSprite } from './openFile';

const yes = () => true;
const no = () => false;

describe('Documents (tabs)', () => {
  it('starts with one untouched untitled tab', () => {
    const docs = new Documents();
    expect(docs.list()).toHaveLength(1);
    expect(isPristine(docs.active())).toBe(true);
  });

  it('opens into the untouched tab, then into new tabs', () => {
    const docs = new Documents();
    const first = docs.active();
    docs.open((ed) => ed.load(createSprite(4, 4), { fileName: 'a' }), newFileRef('C:/a.raster'));
    expect(docs.list()).toHaveLength(1);
    expect(docs.active()).toBe(first);
    docs.open((ed) => ed.load(createSprite(4, 4), { fileName: 'b' }));
    expect(docs.list()).toHaveLength(2);
    expect(docs.active().editor.getState().fileName).toBe('b');
    expect(first.file.path).toBe('C:/a.raster');
  });

  it('keeps each tab’s document separate', () => {
    const docs = new Documents();
    newSprite(docs, 8, 8);
    const a = docs.active();
    a.editor.addLayer();
    newSprite(docs, 16, 16);
    const b = docs.active();
    expect(b).not.toBe(a);
    expect(a.editor.sprite.layers).toHaveLength(2);
    expect(b.editor.sprite.layers).toHaveLength(1);
    expect(b.editor.getState().width).toBe(16);
  });

  it('cycles, activates and reorders tabs', () => {
    const docs = new Documents();
    const [a] = docs.list();
    const b = docs.create();
    const c = docs.create();
    expect(docs.active()).toBe(c);
    docs.cycle(1);
    expect(docs.active()).toBe(a);
    docs.cycle(-1);
    expect(docs.active()).toBe(c);
    docs.reorder([c.id, a.id, b.id]);
    expect(docs.list()).toEqual([c, a, b]);
  });

  it('asks before closing a tab with unsaved changes', () => {
    const docs = new Documents();
    const a = docs.active();
    a.editor.addLayer();
    expect(a.editor.getState().dirty).toBe(true);
    expect(docs.close(a.id, no)).toBe(false);
    expect(docs.list()).toEqual([a]);
    expect(docs.anyDirty()).toBe(true);
    expect(docs.close(a.id, yes)).toBe(true);
    // The last tab is replaced by a fresh one.
    expect(docs.list()).toHaveLength(1);
    expect(docs.active()).not.toBe(a);
    expect(docs.anyDirty()).toBe(false);
  });

  it('activates a neighbor when the active tab closes, and runs teardown', () => {
    const stops: string[] = [];
    const docs = new Documents((ed) => () => stops.push(ed.getState().fileName));
    const a = docs.active();
    const b = docs.create();
    docs.create();
    docs.activate(b.id);
    docs.close(b.id, yes);
    expect(docs.active()).not.toBe(b);
    expect(stops).toEqual(['untitled']);
    docs.closeOthers(a.id, yes);
    expect(docs.list()).toEqual([a]);
  });

  it('gives a stable snapshot until something changes', () => {
    const docs = new Documents();
    const s1 = docs.getSnapshot();
    expect(docs.getSnapshot()).toBe(s1);
    docs.create();
    expect(docs.getSnapshot()).not.toBe(s1);
  });
});

/** In-memory storage that can be told to fill up. */
function memoryStorage(limit = Infinity): AutosaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      const size = [...data].reduce((n, [key, val]) => n + (key === k ? 0 : val.length), 0);
      if (size + v.length > limit) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k) => void data.delete(k),
  };
}

describe('autosave with tabs', () => {
  afterEach(() => vi.useRealTimers());

  it('saves every tab and restores them in order with the active one', () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const docs = new Documents();
    docs.open((ed) => ed.load(createSprite(2, 2), { fileName: 'one', dirty: true }));
    docs.open((ed) => ed.load(createSprite(3, 3), { fileName: 'two' }));
    const stop = startAutosave(docs, storage);
    docs.activate(docs.list()[0].id);
    vi.runAllTimers();
    stop();

    const restored = loadAutosave(storage);
    expect(restored.docs.map((d) => [d.fileName, d.sprite.width, d.dirty])).toEqual([
      ['one', 2, true],
      ['two', 3, false],
    ]);
    expect(restored.active).toBe(docs.list()[0].id);
  });

  it('forgets closed tabs', () => {
    const storage = memoryStorage();
    const docs = new Documents();
    const b = docs.create();
    const stop = startAutosave(docs, storage);
    docs.close(b.id, yes);
    stop();
    expect(loadAutosave(storage).docs.map((d) => d.id)).toEqual([docs.list()[0].id]);
  });

  it('reads the single document saved before tabs existed', () => {
    const storage = memoryStorage();
    const docs = new Documents();
    docs.open((ed) => ed.load(createSprite(5, 5), { fileName: 'old', dirty: true }));
    const project = JSON.stringify({
      fileName: 'old',
      dirty: true,
      project: JSON.stringify(JSON.parse(serialize(docs))),
    });
    storage.setItem('raster:autosave', project);
    const restored = loadAutosave(storage);
    expect(restored.docs).toHaveLength(1);
    expect(restored.docs[0]).toMatchObject({ fileName: 'old', dirty: true });
    expect(restored.docs[0].sprite.width).toBe(5);
  });

  it('makes room by dropping saved copies of tabs without unsaved changes', () => {
    const big = memoryStorage(Infinity);
    const docs = new Documents();
    docs.open((ed) => ed.load(createSprite(64, 64), { fileName: 'clean' }));
    docs.open((ed) => ed.load(createSprite(64, 64), { fileName: 'dirty', dirty: true }));
    startAutosave(docs, big)();
    const one = [...big.data.values()].find((v) => v.includes('"dirty"'))!.length;
    // Room for the index and one tab only.
    const tight = memoryStorage(one * 1.5);
    startAutosave(docs, tight)();
    const kept = loadAutosave(tight).docs.map((d) => d.fileName);
    expect(kept).toEqual(['dirty']);
  });
});

/** The active tab's project as `.raster` text, via the autosave of a scratch store. */
function serialize(docs: Documents): string {
  const storage = memoryStorage();
  startAutosave(docs, storage)();
  const saved = [...storage.data.entries()].find(([k]) => k.includes(':doc:'))!;
  return JSON.parse(saved[1]).project;
}
