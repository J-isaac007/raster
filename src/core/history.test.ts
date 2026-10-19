import { describe, expect, it } from 'vitest';
import { applyPatch, diffPixels, History } from './history';

function counter() {
  const state = { value: 0 };
  const step = (by: number, mergeKey?: string) => ({
    label: `+${by}`,
    mergeKey,
    undo: () => (state.value -= by),
    redo: () => (state.value += by),
  });
  return { state, step };
}

describe('History', () => {
  it('undoes and redoes in order', () => {
    const h = new History();
    const { state, step } = counter();
    for (const n of [1, 2, 3]) {
      state.value += n;
      h.push(step(n));
    }
    expect(h.undoLabel).toBe('+3');
    h.undo();
    h.undo();
    expect(state.value).toBe(1);
    h.redo();
    expect(state.value).toBe(3);
    expect(h.redoLabel).toBe('+3');
  });

  it('drops the redo stack on a new push', () => {
    const h = new History();
    const { state, step } = counter();
    state.value += 1;
    h.push(step(1));
    h.undo();
    state.value += 5;
    h.push(step(5));
    expect(h.redo()).toBeUndefined();
    expect(state.value).toBe(5);
  });

  it('merges commands with the same key', () => {
    const h = new History();
    const { state, step } = counter();
    for (const n of [1, 1, 1]) {
      state.value += n;
      h.push(step(n, 'k'));
    }
    h.undo();
    // The merged command undoes with the first step's undo.
    expect(state.value).toBe(2);
    expect(h.undoLabel).toBeUndefined();
  });

  it('respects the size limit', () => {
    const h = new History(2);
    const { step } = counter();
    h.push(step(1));
    h.push(step(2));
    h.push(step(3));
    expect(h.undo()?.label).toBe('+3');
    expect(h.undo()?.label).toBe('+2');
    expect(h.undo()).toBeUndefined();
  });
});

describe('pixel patches', () => {
  it('records only changed pixels and applies both ways', () => {
    const before = Uint32Array.from([1, 2, 3, 4]);
    const after = Uint32Array.from([1, 9, 3, 8]);
    const patch = diffPixels(before, after)!;
    expect([...patch.indices]).toEqual([1, 3]);

    const work = after.slice();
    applyPatch(work, patch, 'before');
    expect([...work]).toEqual([...before]);
    applyPatch(work, patch, 'after');
    expect([...work]).toEqual([...after]);
  });

  it('returns null when nothing changed', () => {
    expect(diffPixels(Uint32Array.of(1), Uint32Array.of(1))).toBeNull();
  });
});
