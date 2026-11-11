import { copyCelProps } from '@core/cels';
import { compositeFrame, mapCels, type CompositeOptions, type Sprite } from '@core/sprite';
import {
  cleanTag,
  nextPlaybackFrame,
  tagAt,
  tagsAfterDelete,
  tagsAfterInsert,
  type Tag,
} from '@core/tags';
import type { EditorCore } from './core';
import { clampDuration, type EditorState } from './state';

/**
 * Animation frames: navigation, adding and removing, linked cels, tags,
 * timing and playback.
 */
export class EditorFrames {
  /** The tag playback loops in, picked when playback starts. */
  private playTag: Tag | null = null;

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
    const tagsBefore = sprite.tags;
    const tagsAfter = tagsAfterInsert(tagsBefore, index);
    const apply = () => {
      sprite.frames.splice(index, 0, frame);
      layers.forEach((l, i) => l.cels.splice(index, 0, cels[i]));
      sprite.tags = tagsAfter;
    };
    apply();
    core.history.push({
      label,
      undo: () => {
        sprite.frames.splice(index, 1);
        layers.forEach((l) => l.cels.splice(index, 1));
        sprite.tags = tagsBefore;
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

  /**
   * The frames Delete and Duplicate act on: the timeline's picked frames if
   * the current frame is among them, else just the current frame.
   */
  selectedFrames(): [number, number] {
    const { timelineSelection: sel, frame } = this.core.getState();
    if (sel && frame >= sel.frames[0] && frame <= sel.frames[1]) return [...sel.frames];
    return [frame, frame];
  }

  /** Duplicates the picked frames (or the current one) right after them. */
  duplicateFrame(): void {
    const [lo, hi] = this.selectedFrames();
    if (hi > lo) {
      this.moveFrames(lo, hi, hi + 1, true);
      return;
    }
    const i = this.core.getState().frame;
    this.core.settle();
    const { sprite } = this.core;
    this.insertFrame(
      i + 1,
      sprite.frames[i].duration,
      sprite.layers.map((l) => {
        const copy = l.cels[i].slice();
        copyCelProps(l.cels[i], copy);
        return copy;
      }),
      'Duplicate Frame',
    );
  }

  /** Adds a copy of the current frame whose cels are linked to it. */
  duplicateLinkedFrame(): void {
    const i = this.core.getState().frame;
    const { sprite } = this.core;
    this.insertFrame(
      i + 1,
      sprite.frames[i].duration,
      sprite.layers.map((l) => l.cels[i]),
      'Duplicate Linked Frame',
    );
  }

  /** True if the active layer's current cel is shared with another frame. */
  get celLinked(): boolean {
    const { cels, pixels } = this.core.activeLayer;
    return cels.indexOf(pixels) !== cels.lastIndexOf(pixels);
  }

  /** Gives the active layer's current frame its own copy of a linked cel. */
  unlinkCel(): void {
    const { core } = this;
    core.settle();
    if (!this.celLinked) {
      core.notify('This cel is not linked');
      return;
    }
    const layer = core.activeLayer;
    const f = core.getState().frame;
    const shared = layer.cels[f];
    const own = shared.slice();
    copyCelProps(shared, own);
    layer.cels[f] = own;
    core.record({
      label: 'Unlink Cel',
      frame: f,
      undo: () => (layer.cels[f] = shared),
      redo: () => (layer.cels[f] = own),
    });
  }

  /** Deletes the picked frames (or the current one). */
  deleteFrame(): void {
    this.deleteFrames(...this.selectedFrames());
  }

  /** Deletes frames `lo`..`hi` (inclusive). At least one frame always stays. */
  deleteFrames(lo: number, hi: number): void {
    const { core } = this;
    [lo, hi] = [Math.max(0, Math.min(lo, hi)), Math.min(this.frameCount - 1, Math.max(lo, hi))];
    if (hi - lo + 1 >= this.frameCount) {
      core.notify('A sprite needs at least one frame');
      return;
    }
    const count = hi - lo + 1;
    this.changeFrames(
      count > 1 ? 'Delete Frames' : 'Delete Frame',
      (sprite) => {
        sprite.frames.splice(lo, count);
        for (const l of sprite.layers) l.cels.splice(lo, count);
        for (let i = hi; i >= lo; i--) sprite.tags = tagsAfterDelete(sprite.tags, i);
      },
      Math.min(lo, this.frameCount - count - 1),
      { timelineSelection: null },
    );
  }

  /**
   * Runs a change to the frame list (frames, cels, tags) as one undo step that
   * restores everything as it was, then shows `frame`.
   */
  private changeFrames(
    label: string,
    change: (sprite: Sprite) => void,
    frame: number,
    patch: Partial<EditorState> = {},
    /** The frame to show after undoing (default: the one shown before). */
    frameUndo?: number,
  ): void {
    const { core } = this;
    core.settle();
    const { sprite } = core;
    const layers = [...sprite.layers];
    const snap = () => ({
      frames: [...sprite.frames],
      cels: layers.map((l) => [...l.cels]),
      tags: sprite.tags,
    });
    const restore = (state: ReturnType<typeof snap>) => {
      sprite.frames.splice(0, sprite.frames.length, ...state.frames);
      layers.forEach((l, i) => l.cels.splice(0, l.cels.length, ...state.cels[i]));
      sprite.tags = state.tags;
    };
    const frameBefore = frameUndo ?? core.getState().frame;
    const before = snap();
    change(sprite);
    const after = snap();
    core.history.push({
      label,
      undo: () => {
        restore(before);
        core.stage({ frame: frameBefore, timelineSelection: null });
      },
      redo: () => {
        restore(after);
        core.stage({ frame, ...patch });
      },
    });
    core.commit({ frame, dirty: true, ...patch });
  }

  /** Moves the current frame earlier (-1) or later (+1). */
  moveFrame(delta: 1 | -1): void {
    const from = this.core.getState().frame;
    this.moveFrameTo(from, from + delta);
  }

  /**
   * Moves frame `from` so it ends up at index `to`, with its cel on every
   * layer, and selects it. Linked cels stay linked (they share one array);
   * tags keep their frame numbers. One undo step.
   */
  moveFrameTo(from: number, to: number): void {
    const n = this.frameCount;
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
    this.moveFrames(from, from, to > from ? to + 1 : to);
  }

  /**
   * Moves frames `lo`..`hi` to the gap `slot` (0 = before the first frame,
   * frameCount = after the last), or with `copy` inserts a copy of them there.
   * Copies get their own cels (cels linked inside the block stay linked to
   * each other). Moving keeps tags at their frame numbers; copying shifts the
   * tags after the gap. The moved or copied frames end up selected.
   */
  moveFrames(lo: number, hi: number, slot: number, copy = false): void {
    const n = this.frameCount;
    if (lo < 0 || hi >= n || lo > hi || slot < 0 || slot > n) return;
    const count = hi - lo + 1;
    if (!copy && slot >= lo && slot <= hi + 1) return;
    const start = copy || slot < lo ? slot : slot - count;
    const offset = this.core.getState().frame - lo;
    const current = start + (offset >= 0 && offset < count ? offset : 0);
    const label = (copy ? 'Copy Frame' : 'Move Frame') + (count > 1 ? 's' : '');
    this.changeFrames(
      label,
      (sprite) => {
        if (copy) {
          sprite.frames.splice(slot, 0, ...sprite.frames.slice(lo, hi + 1).map((f) => ({ ...f })));
          for (const l of sprite.layers) {
            l.cels.splice(slot, 0, ...mapCels(l.cels.slice(lo, hi + 1), (c) => c.slice()));
          }
          for (let i = 0; i < count; i++) sprite.tags = tagsAfterInsert(sprite.tags, slot);
          return;
        }
        sprite.frames.splice(start, 0, ...sprite.frames.splice(lo, count));
        for (const l of sprite.layers) l.cels.splice(start, 0, ...l.cels.splice(lo, count));
      },
      current,
      { timelineSelection: { layerIds: [], frames: [start, start + count - 1] } },
      // Undoing a move shows the moved frame back where it came from.
      copy ? undefined : lo + (current - start),
    );
  }

  /**
   * Moves cels to other frames and layers, or with `copy` copies them.
   * `sources` and `targets` are matching lists of layer ids (row by row);
   * every cel in frames `lo`..`hi` of a source lands `dFrame` frames later
   * in its target, replacing the cel there. Moving leaves empty cels behind.
   * A cel moved within its layer keeps its buffer (and links); anything else
   * gets its own copy. Nothing happens if a cel would land outside the sprite.
   */
  moveCels(
    sources: string[],
    targets: string[],
    lo: number,
    hi: number,
    dFrame: number,
    copy = false,
  ): void {
    const { sprite } = this.core;
    const n = this.frameCount;
    const byId = (id: string) => sprite.layers.find((l) => l.id === id);
    const src = sources.map(byId);
    const dst = targets.map(byId);
    const valid =
      src.length > 0 &&
      src.length === dst.length &&
      src.every(Boolean) &&
      dst.every(Boolean) &&
      lo >= 0 &&
      lo <= hi &&
      hi < n &&
      lo + dFrame >= 0 &&
      hi + dFrame < n &&
      !(dFrame === 0 && src.every((l, i) => l === dst[i]));
    if (!valid) return;
    const size = sprite.width * sprite.height;
    const frame = this.core.getState().frame;
    this.changeFrames(
      copy ? 'Copy Cels' : 'Move Cels',
      () => {
        // Read everything first, so overlapping moves don't read their own writes.
        const picked = src.map((l) => l!.cels.slice(lo, hi + 1));
        if (!copy) {
          for (const l of src) for (let f = lo; f <= hi; f++) l!.cels[f] = new Uint32Array(size);
        }
        dst.forEach((l, i) => {
          const sameLayer = l === src[i];
          picked[i].forEach((cel, k) => {
            let out = cel;
            if (copy || !sameLayer) {
              out = cel.slice();
              copyCelProps(cel, out);
            }
            l!.cels[lo + k + dFrame] = out;
          });
        });
      },
      Math.min(n - 1, Math.max(0, frame + dFrame)),
      { timelineSelection: { layerIds: [...targets], frames: [lo + dFrame, hi + dFrame] } },
    );
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

  /** Replaces the tag list as one undo step. */
  private setTags(tags: Tag[], label: string): void {
    const { sprite } = this.core;
    const before = sprite.tags;
    sprite.tags = tags;
    this.core.history.push({
      label,
      undo: () => (sprite.tags = before),
      redo: () => (sprite.tags = tags),
    });
    this.core.commit({ dirty: true }, false);
  }

  /** Adds a tag; by default "Tag N" covering the current frame. */
  addTag(tag?: Partial<Tag>): void {
    this.core.settle();
    const { frame } = this.core.getState();
    const { tags } = this.core.sprite;
    const next = cleanTag(
      { name: `Tag ${tags.length + 1}`, from: frame, to: frame, ...tag },
      this.frameCount,
    );
    this.setTags([...tags, next], 'New Tag');
  }

  /** Renames a tag or changes its frames. */
  updateTag(index: number, patch: Partial<Tag>): void {
    const { tags } = this.core.sprite;
    const old = tags[index];
    if (!old) return;
    this.core.settle();
    const next = cleanTag({ ...old, ...patch }, this.frameCount);
    if (next.name === old.name && next.from === old.from && next.to === old.to) return;
    this.setTags(
      tags.map((t, i) => (i === index ? next : t)),
      'Edit Tag',
    );
  }

  deleteTag(index: number): void {
    const { tags } = this.core.sprite;
    if (!tags[index]) return;
    this.core.settle();
    this.setTags(
      tags.filter((_, i) => i !== index),
      'Delete Tag',
    );
  }

  /** Starts or stops playback. It loops in the tag the current frame is in, if any. */
  setPlaying(playing: boolean): void {
    const next = playing && this.frameCount > 1 && !this.core.stroking;
    if (next === this.core.getState().playing) return;
    if (next) {
      this.core.settle();
      this.playTag = tagAt(this.core.sprite.tags, this.core.getState().frame);
    }
    this.core.set({ playing: next });
  }

  /** Steps playback to the next frame. */
  advancePlayback(): void {
    const { frame } = this.core.getState();
    this.setFrame(nextPlaybackFrame(frame, this.frameCount, this.playTag));
  }

  setOnionSkin(onionSkin: boolean): void {
    this.core.set({ onionSkin });
  }

  /** Flattened image of any frame, for export, previews and onion skins. */
  flattenFrame(frame: number, options?: CompositeOptions): Uint32Array {
    return compositeFrame(this.core.sprite, frame, undefined, options);
  }
}
