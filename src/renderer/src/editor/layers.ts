import { celOpacity, copyCelProps, setCelOpacity } from '@core/cels';
import { TRANSPARENT } from '@core/color';
import {
  groupSpan,
  moveItem,
  pruneGroups,
  restoreStack,
  snapshotStack,
  ungroup,
  wrapInGroup,
  type StackItem,
} from '@core/groups';
import {
  cloneLayer,
  createGroup,
  createLayer,
  flipPixels,
  mergeInto,
  type Group,
  type Layer,
} from '@core/sprite';
import type { EditorCore } from './core';
import type { EditorStrokes } from './strokes';

type LayerPatch = Partial<
  Pick<Layer, 'name' | 'visible' | 'locked' | 'opacity' | 'blendMode' | 'reference'>
>;
type GroupPatch = Partial<Pick<Group, 'name' | 'visible' | 'opacity' | 'blendMode' | 'collapsed'>>;

const PATCH_LABELS: Record<string, string> = {
  name: 'Rename Layer',
  opacity: 'Layer Opacity',
  blendMode: 'Blend Mode',
  reference: 'Reference Layer',
};

/**
 * The layer stack: adding, removing, reordering, grouping, merging, and layer,
 * group and cel properties.
 */
export class EditorLayers {
  constructor(
    private readonly core: EditorCore,
    private readonly strokes: EditorStrokes,
  ) {}

  setActiveLayer(id: string): void {
    this.core.settle();
    this.core.set({ activeLayerId: id, activeGroupId: null });
  }

  /** Picks a group in the layer list. Drawing still goes to the active layer. */
  setActiveGroup(id: string): void {
    this.core.settle();
    this.core.set({ activeGroupId: id });
  }

  private layerIndex(id: string): number {
    return this.core.sprite.layers.findIndex((l) => l.id === id);
  }

  /** The picked row: the active group if one is picked, else the active layer. */
  private activeItem(): StackItem {
    const { activeGroupId, activeLayerId } = this.core.getState();
    return activeGroupId
      ? { kind: 'group', id: activeGroupId }
      : { kind: 'layer', id: activeLayerId };
  }

  /**
   * Runs a change to the stack's structure (order, groups) as one undo step,
   * dropping groups it leaves empty.
   */
  private restructure(
    label: string,
    change: () => boolean,
    after: { activeLayerId?: string; activeGroupId?: string | null } = {},
  ): void {
    const { core } = this;
    core.settle();
    const sprite = core.sprite;
    const { activeLayerId, activeGroupId } = core.getState();
    const before = snapshotStack(sprite);
    if (!change()) return;
    pruneGroups(sprite);
    const done = snapshotStack(sprite);
    const activeAfter = {
      activeLayerId: after.activeLayerId ?? activeLayerId,
      activeGroupId: after.activeGroupId !== undefined ? after.activeGroupId : activeGroupId,
    };
    core.history.push({
      label,
      undo: () => {
        restoreStack(sprite, before);
        core.stage({ activeLayerId, activeGroupId });
      },
      redo: () => {
        restoreStack(sprite, done);
        core.stage(activeAfter);
      },
    });
    core.commit({ ...activeAfter, dirty: true });
  }

  private insertLayer(layer: Layer, index: number, label: string): void {
    const { core } = this;
    core.settle();
    const layers = core.sprite.layers;
    const prev = {
      activeLayerId: core.getState().activeLayerId,
      activeGroupId: core.getState().activeGroupId,
    };
    layers.splice(index, 0, layer);
    core.history.push({
      label,
      undo: () => {
        layers.splice(layers.indexOf(layer), 1);
        core.stage(prev);
      },
      redo: () => {
        layers.splice(index, 0, layer);
        core.stage({ activeLayerId: layer.id, activeGroupId: null });
      },
    });
    core.commit({ activeLayerId: layer.id, activeGroupId: null, dirty: true });
  }

  /** Adds a layer above the active one, in its group; with a group picked, at the top of it. */
  addLayer(): void {
    const { sprite } = this.core;
    const n = sprite.layers.length + 1;
    const layer = createLayer(sprite.width, sprite.height, `Layer ${n}`, sprite.frames.length);
    const { activeGroupId, activeLayerId } = this.core.getState();
    const span = activeGroupId ? groupSpan(sprite, activeGroupId) : null;
    if (span && activeGroupId) {
      layer.groupId = activeGroupId;
      this.insertLayer(layer, span[1] + 1, 'New Layer');
      return;
    }
    const i = this.layerIndex(activeLayerId);
    layer.groupId = sprite.layers[i]?.groupId ?? null;
    this.insertLayer(layer, i + 1, 'New Layer');
  }

  duplicateLayer(id = this.core.getState().activeLayerId): void {
    const i = this.layerIndex(id);
    if (i < 0) return;
    this.insertLayer(cloneLayer(this.core.sprite.layers[i]), i + 1, 'Duplicate Layer');
  }

  /** Deletes the active layer, or the picked group with everything in it. */
  deleteLayer(id?: string): void {
    const { core } = this;
    const sprite = core.sprite;
    const item: StackItem = id ? { kind: 'layer', id } : this.activeItem();
    const span =
      item.kind === 'group'
        ? groupSpan(sprite, item.id)
        : ([this.layerIndex(item.id), this.layerIndex(item.id)] as const);
    if (!span || span[0] < 0) return;
    const [lo, hi] = span;
    if (hi - lo + 1 >= sprite.layers.length) {
      core.settle();
      core.notify('A sprite needs at least one layer');
      return;
    }
    const remaining = [...sprite.layers.slice(0, lo), ...sprite.layers.slice(hi + 1)];
    const next = remaining[Math.min(lo, remaining.length - 1)];
    this.restructure(
      item.kind === 'group' ? 'Delete Group' : 'Delete Layer',
      () => {
        sprite.layers.splice(lo, hi - lo + 1);
        if (item.kind === 'group') {
          // Nested groups go with it; pruneGroups drops them once empty.
          ungroup(sprite, item.id);
        }
        return true;
      },
      { activeLayerId: next.id, activeGroupId: null },
    );
  }

  /** Moves the picked layer or group up (+1, toward the top) or down (-1). See `moveItem`. */
  moveLayer(id: string | null, delta: 1 | -1): void {
    const item: StackItem = id ? { kind: 'layer', id } : this.activeItem();
    this.restructure(item.kind === 'group' ? 'Move Group' : 'Move Layer', () =>
      moveItem(this.core.sprite, item, delta),
    );
  }

  /** Puts the picked layer or group in a new group, and picks the group. */
  groupLayers(): void {
    const sprite = this.core.sprite;
    const group = createGroup(`Group ${sprite.groups.length + 1}`);
    const item = this.activeItem();
    this.restructure(
      'Group Layers',
      () => {
        wrapInGroup(sprite, item, group);
        return true;
      },
      { activeGroupId: group.id },
    );
  }

  /** Removes the picked group (or the active layer's group), keeping its contents. */
  ungroup(): void {
    const { activeGroupId, activeLayerId } = this.core.getState();
    const id = activeGroupId ?? this.core.sprite.layers[this.layerIndex(activeLayerId)]?.groupId;
    if (!id) {
      this.core.notify('Not in a group');
      return;
    }
    this.restructure(
      'Ungroup',
      () => {
        ungroup(this.core.sprite, id);
        return true;
      },
      { activeGroupId: null },
    );
  }

  mergeDown(id = this.core.getState().activeLayerId): void {
    const { core } = this;
    core.settle();
    const layers = core.sprite.layers;
    const i = this.layerIndex(id);
    const upper = layers[i];
    const lower = layers[i - 1];
    if (!upper || !lower || lower.groupId !== upper.groupId) {
      core.notify(i <= 0 ? 'No layer below to merge into' : 'No layer below in this group');
      return;
    }
    if (upper.reference || lower.reference) {
      core.notify("Reference layers can't be merged");
      return;
    }
    // Merged cels are new buffers. Linked frames stay linked unless the upper
    // layer differs between them (empty upper cels count as the same).
    const lowerBefore = lower.cels;
    const merged = new Map<string, Uint32Array>();
    const upperKey = (cel: Uint32Array) =>
      cel.every((c) => c >>> 24 === 0) ? 'empty' : upper.cels.indexOf(cel);
    const lowerAfter = lower.cels.map((cel, f) => {
      const key = `${lower.cels.indexOf(cel)}:${upperKey(upper.cels[f])}`;
      let out = merged.get(key);
      if (!out) {
        out = cel.slice();
        copyCelProps(cel, out);
        mergeInto({ ...lower, pixels: out }, { ...upper, pixels: upper.cels[f] });
        merged.set(key, out);
      }
      return out;
    });
    lower.cels = lowerAfter;
    layers.splice(i, 1);
    core.history.push({
      label: 'Merge Down',
      undo: () => {
        lower.cels = lowerBefore;
        layers.splice(i, 0, upper);
        core.stage({ activeLayerId: upper.id });
      },
      redo: () => {
        lower.cels = lowerAfter;
        layers.splice(i, 1);
        core.stage({ activeLayerId: lower.id });
      },
    });
    core.commit({ activeLayerId: lower.id, dirty: true });
  }

  /**
   * Changes layer properties. Name, opacity, blend mode and reference are
   * undoable; visibility and lock are not.
   */
  updateLayer(id: string, patch: LayerPatch): void {
    const layer = this.core.sprite.layers.find((l) => l.id === id);
    if (!layer) return;
    this.core.settle();
    const { visible, locked, ...tracked } = patch;
    if (visible !== undefined) layer.visible = visible;
    if (locked !== undefined) layer.locked = locked;
    const keys = (Object.keys(tracked) as (keyof typeof tracked)[]).filter(
      (k) => tracked[k] !== layer[k],
    );
    if (keys.length === 0) {
      this.core.commit({ dirty: true }, visible !== undefined);
      return;
    }
    const before = Object.fromEntries(keys.map((k) => [k, layer[k]]));
    const after = Object.fromEntries(keys.map((k) => [k, tracked[k]]));
    Object.assign(layer, after);
    this.core.record({
      label: PATCH_LABELS[keys[0]] ?? 'Layer Properties',
      mergeKey: keys.length === 1 && keys[0] === 'opacity' ? `opacity:${id}` : undefined,
      undo: () => Object.assign(layer, before),
      redo: () => Object.assign(layer, after),
    });
  }

  /**
   * Changes group properties. Name, opacity and blend mode are undoable;
   * visibility and folding are not.
   */
  updateGroup(id: string, patch: GroupPatch): void {
    const group = this.core.sprite.groups.find((g) => g.id === id);
    if (!group) return;
    this.core.settle();
    const { visible, collapsed, ...tracked } = patch;
    if (visible !== undefined) group.visible = visible;
    if (collapsed !== undefined) group.collapsed = collapsed;
    const keys = (Object.keys(tracked) as (keyof typeof tracked)[]).filter(
      (k) => tracked[k] !== group[k],
    );
    if (keys.length === 0) {
      this.core.commit({ dirty: true }, visible !== undefined);
      return;
    }
    const before = Object.fromEntries(keys.map((k) => [k, group[k]]));
    const after = Object.fromEntries(keys.map((k) => [k, tracked[k]]));
    Object.assign(group, after);
    this.core.record({
      label:
        keys[0] === 'name'
          ? 'Rename Group'
          : keys[0] === 'opacity'
            ? 'Group Opacity'
            : 'Blend Mode',
      mergeKey: keys.length === 1 && keys[0] === 'opacity' ? `group-opacity:${id}` : undefined,
      undo: () => Object.assign(group, before),
      redo: () => Object.assign(group, after),
    });
  }

  /**
   * Sets the opacity (0..1) of the cels in `frames` on one or more layers.
   * Linked cels share one opacity. Repeated changes to the same cels merge
   * into one undo step.
   */
  setCelOpacity(layerIds: string | string[], frames: number[], opacity: number): void {
    const ids = Array.isArray(layerIds) ? layerIds : [layerIds];
    const layers = this.core.sprite.layers.filter((l) => ids.includes(l.id));
    if (layers.length === 0) return;
    this.core.settle();
    const cels = [...new Set(layers.flatMap((l) => frames.map((f) => l.cels[f])).filter(Boolean))];
    const before = cels.map(celOpacity);
    if (before.every((v) => v === opacity)) return;
    const apply = (values: number[] | number) =>
      cels.forEach((c, i) => setCelOpacity(c, Array.isArray(values) ? values[i] : values));
    apply(opacity);
    this.core.record({
      label: 'Cel Opacity',
      mergeKey: `cel-opacity:${ids.join(',')}:${frames.join(',')}`,
      undo: () => apply(before),
      redo: () => apply(opacity),
    });
  }

  clearLayer(): void {
    if (!this.strokes.beginStroke()) return;
    this.core.activeLayer.pixels.fill(TRANSPARENT);
    this.strokes.endStroke('Clear');
  }

  flip(axis: 'horizontal' | 'vertical', scope: 'layer' | 'sprite'): void {
    const { core } = this;
    core.settle();
    if (scope === 'layer' && core.activeLayer.locked) {
      core.notify('Layer is locked');
      return;
    }
    // A layer flip changes the current cel; a sprite flip changes every cel.
    const { width, height } = core.sprite;
    // Linked cels share a buffer: flip each buffer once.
    const targets =
      scope === 'layer'
        ? [core.activeLayer.pixels]
        : [...new Set(core.sprite.layers.flatMap((l) => l.cels))];
    const run = () => targets.forEach((pixels) => flipPixels({ width, height, pixels }, axis));
    run();
    const label = `Flip ${axis === 'horizontal' ? 'Horizontal' : 'Vertical'}`;
    const frame = scope === 'layer' ? core.getState().frame : undefined;
    core.record({ label, frame, undo: run, redo: run });
  }
}
