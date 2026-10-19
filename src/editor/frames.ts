import { compositeFrame } from '../core/sprite';
import type { EditorCore } from './core';
import { clampDuration } from './state';

/** Animation frames: navigation, adding and removing, timing and playback. */
export class EditorFrames {
  constructor(private readonly core: EditorCore) {}

  get frameCount(): number {
    return this.core.sprite.frames.length;
  }

  /** Shows another frame (wrapping around). Navigation, so not undoable. */
  setFrame(frame: number): void {
    if (this.core.stroking) return;
    const n = this.frameCount;
    const f = ((frame % n) + n) % n;
    if (f === this.core.getState().frame) return;
    this.core.settle();
    this.core.commit({ frame: f });
  }

  nextFrame(): void {
    this.setFrame(this.core.getState().frame + 1);
  }

  prevFrame(): void {
    this.setFrame(this.core.getState().frame - 1);
  }

  /** Inserts a frame at `index`, with one cel per layer. */
  private insertFrame(index: number, duration: number, cels: Uint32Array[], label: string): void {
    const { core } = this;
    core.settle();
    const { sprite } = core;
    const layers = [...sprite.layers];
    const frame = { duration };
    const prev = core.getState().frame;
    const apply = () => {
      sprite.frames.splice(index, 0, frame);
      layers.forEach((l, i) => l.cels.splice(index, 0, cels[i]));
    };
    apply();
    core.history.push({
      label,
      undo: () => {
        sprite.frames.splice(index, 1);
        layers.forEach((l) => l.cels.splice(index, 1));
        core.stage({ frame: prev });
      },
      redo: () => {
        apply();
        core.stage({ frame: index });
      },
    });
    core.commit({ frame: index, dirty: true });
  }

  addFrame(): void {
    const { sprite } = this.core;
    const size = sprite.width * sprite.height;
    const i = this.core.getState().frame;
    this.insertFrame(
      i + 1,
      sprite.frames[i].duration,
      sprite.layers.map(() => new Uint32Array(size)),
      'New Frame',
    );
  }

  duplicateFrame(): void {
    const i = this.core.getState().frame;
    this.core.settle();
    const { sprite } = this.core;
    this.insertFrame(
      i + 1,
      sprite.frames[i].duration,
      sprite.layers.map((l) => l.cels[i].slice()),
      'Duplicate Frame',
    );
  }

  deleteFrame(): void {
    const { core } = this;
    if (this.frameCount <= 1) {
      core.notify('A sprite needs at least one frame');
      return;
    }
    core.settle();
    const { sprite } = core;
    const i = core.getState().frame;
    const layers = [...sprite.layers];
    const [frame] = sprite.frames.splice(i, 1);
    const removed = layers.map((l) => l.cels.splice(i, 1)[0]);
    const after = Math.min(i, sprite.frames.length - 1);
    core.history.push({
      label: 'Delete Frame',
      undo: () => {
        sprite.frames.splice(i, 0, frame);
        layers.forEach((l, k) => l.cels.splice(i, 0, removed[k]));
        core.stage({ frame: i });
      },
      redo: () => {
        sprite.frames.splice(i, 1);
        layers.forEach((l) => l.cels.splice(i, 1));
        core.stage({ frame: after });
      },
    });
    core.commit({ frame: after, dirty: true });
  }

  /** Moves the current frame earlier (-1) or later (+1). */
  moveFrame(delta: 1 | -1): void {
    const { core } = this;
    const from = core.getState().frame;
    const to = from + delta;
    if (to < 0 || to >= this.frameCount) return;
    core.settle();
    const { sprite } = core;
    const layers = [...sprite.layers];
    const swap = () => {
      const f = sprite.frames;
      [f[from], f[to]] = [f[to], f[from]];
      for (const l of layers) [l.cels[from], l.cels[to]] = [l.cels[to], l.cels[from]];
    };
    swap();
    core.history.push({
      label: 'Move Frame',
      undo: () => {
        swap();
        core.stage({ frame: from });
      },
      redo: () => {
        swap();
        core.stage({ frame: to });
      },
    });
    core.commit({ frame: to, dirty: true });
  }

  /** Sets one frame's duration (ms). Repeated edits to a frame merge into one undo step. */
  setFrameDuration(frame: number, ms: number): void {
    const target = this.core.sprite.frames[frame];
    if (!target) return;
    const duration = clampDuration(ms);
    const before = target.duration;
    if (before === duration) return;
    target.duration = duration;
    this.core.history.push({
      label: 'Frame Duration',
      mergeKey: `duration:${frame}`,
      undo: () => (target.duration = before),
      redo: () => (target.duration = duration),
    });
    this.core.commit({ dirty: true }, false);
  }

  /** Gives every frame the same duration. */
  setAllFrameDurations(ms: number): void {
    const duration = clampDuration(ms);
    const frames = [...this.core.sprite.frames];
    const before = frames.map((f) => f.duration);
    if (before.every((d) => d === duration)) return;
    frames.forEach((f) => (f.duration = duration));
    this.core.history.push({
      label: 'Frame Duration',
      undo: () => frames.forEach((f, i) => (f.duration = before[i])),
      redo: () => frames.forEach((f) => (f.duration = duration)),
    });
    this.core.commit({ dirty: true }, false);
  }

  setPlaying(playing: boolean): void {
    const next = playing && this.frameCount > 1 && !this.core.stroking;
    if (next === this.core.getState().playing) return;
    if (next) this.core.settle();
    this.core.set({ playing: next });
  }

  setOnionSkin(onionSkin: boolean): void {
    this.core.set({ onionSkin });
  }

  /** Flattened image of any frame, for export, previews and onion skins. */
  flattenFrame(frame: number): Uint32Array {
    return compositeFrame(this.core.sprite, frame);
  }
}
