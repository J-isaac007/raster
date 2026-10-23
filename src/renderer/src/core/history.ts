export interface Command {
  label: string;
  undo(): void;
  redo(): void;
  /**
   * Consecutive commands sharing a merge key collapse into one undo step
   * (e.g. dragging an opacity slider).
   */
  mergeKey?: string;
  /** The animation frame the change happened on; undo/redo jump back to it. */
  frame?: number;
}

export class History {
  private past: Command[] = [];
  private future: Command[] = [];

  constructor(private readonly limit = 256) {}

  /** Records a command that has already been applied. */
  push(cmd: Command): void {
    const top = this.past[this.past.length - 1];
    if (cmd.mergeKey && top?.mergeKey === cmd.mergeKey && this.future.length === 0) {
      this.past[this.past.length - 1] = { ...cmd, undo: top.undo };
      return;
    }
    this.past.push(cmd);
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }

  undo(): Command | undefined {
    const cmd = this.past.pop();
    if (!cmd) return undefined;
    cmd.undo();
    this.future.push(cmd);
    return cmd;
  }

  redo(): Command | undefined {
    const cmd = this.future.pop();
    if (!cmd) return undefined;
    cmd.redo();
    this.past.push(cmd);
    return cmd;
  }

  /** Stops the top command from merging with the next one. */
  seal(): void {
    const top = this.past[this.past.length - 1];
    if (top?.mergeKey) this.past[this.past.length - 1] = { ...top, mergeKey: undefined };
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }

  get undoLabel(): string | undefined {
    return this.past[this.past.length - 1]?.label;
  }

  get redoLabel(): string | undefined {
    return this.future[this.future.length - 1]?.label;
  }
}

/** A sparse record of changed pixels, cheap to store for small edits. */
export interface PixelPatch {
  indices: Uint32Array;
  before: Uint32Array;
  after: Uint32Array;
}

export function diffPixels(before: Uint32Array, after: Uint32Array): PixelPatch | null {
  const changed: number[] = [];
  for (let i = 0; i < after.length; i++) if (before[i] !== after[i]) changed.push(i);
  if (changed.length === 0) return null;
  const indices = Uint32Array.from(changed);
  return {
    indices,
    before: indices.map((i) => before[i]),
    after: indices.map((i) => after[i]),
  };
}

export function applyPatch(pixels: Uint32Array, patch: PixelPatch, side: 'before' | 'after'): void {
  const values = patch[side];
  const { indices } = patch;
  for (let k = 0; k < indices.length; k++) pixels[indices[k]] = values[k];
}
