import type { Command, History } from '../core/history';
import type { Layer, Sprite } from '../core/sprite';
import type { EditorState } from './state';

/**
 * What the editor's modules (view, frames, layers, selection, strokes) see of
 * the Editor: the document, its history and the state store.
 *
 * Every document change calls `settle()` first, and every undo command
 * captures the exact cel buffer and frame it changed.
 */
export interface EditorCore {
  /** The document. `load` replaces it, so read it on every use. */
  readonly sprite: Sprite;
  readonly history: History;
  readonly activeLayer: Layer;
  /** True while a tool stroke is in progress. */
  readonly stroking: boolean;
  getState(): EditorState;
  /** Patches state and notifies listeners. */
  set(patch: Partial<EditorState>): void;
  /**
   * Patches state without notifying. For undo/redo closures: the commit that
   * follows them notifies.
   */
  stage(patch: Partial<EditorState>): void;
  /** Re-syncs derived document state after any change to `sprite`. */
  commit(patch?: Partial<EditorState>, pixelsChanged?: boolean): void;
  /** Pushes an already-applied command and commits a dirty change. */
  record(cmd: Command): void;
  /** Commits floating pixels, if any. Runs before anything else edits the document. */
  settle(): void;
  notify(message: string): void;
  /** False (and tells the user why) if the layer is hidden or locked. */
  canEdit(layer: Layer): boolean;
}
