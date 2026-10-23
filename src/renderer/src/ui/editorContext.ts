import { createContext, useContext, useRef, useSyncExternalStore } from 'react';
import type { Editor, EditorState } from '@editor/editor';

export const EditorContext = createContext<Editor | null>(null);

export function useEditor(): Editor {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error('useEditor must be used inside <EditorContext.Provider>.');
  return editor;
}

function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a) as (keyof T)[];
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is(a[k], b[k]));
}

/**
 * Subscribes to a slice of editor state. Re-renders only when the selected
 * value changes (shallow compare), so selectors may return fresh objects.
 */
export function useEditorState<T>(selector: (s: EditorState) => T): T {
  const editor = useEditor();
  const cache = useRef<{ state: EditorState; value: T } | null>(null);
  const getSnapshot = () => {
    const state = editor.getState();
    const prev = cache.current;
    if (prev?.state === state) return prev.value;
    const value = selector(state);
    if (prev && shallowEqual(prev.value, value)) {
      cache.current = { state, value: prev.value };
      return prev.value;
    }
    cache.current = { state, value };
    return value;
  };
  return useSyncExternalStore(editor.subscribe, getSnapshot);
}
