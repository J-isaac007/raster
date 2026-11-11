import type { Group, Layer, Sprite } from './sprite';

/**
 * Layer groups. The layer stack stays a flat, bottom-to-top list; a group is a
 * label on a contiguous run of it (layers point at their innermost group with
 * `groupId`, groups at theirs with `parentId`). These helpers read and reshape
 * that structure. Every edit here keeps runs contiguous.
 */

/** Something in the stack: a layer, or a group and everything in it. */
export type StackItem = { kind: 'layer'; id: string } | { kind: 'group'; id: string };

/** The minimum a group needs for structure queries (a Group, or GroupInfo from editor state). */
interface GroupLike {
  id: string;
  parentId: string | null;
  collapsed: boolean;
}

/** The groups enclosing `groupId`, outermost first, ending with it (empty for null). */
export function groupChain<G extends GroupLike>(groups: readonly G[], groupId: string | null): G[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const chain: G[] = [];
  const seen = new Set<string>();
  for (let id = groupId; id && !seen.has(id); id = byId.get(id)?.parentId ?? null) {
    seen.add(id);
    const g = byId.get(id);
    if (g) chain.unshift(g);
  }
  return chain;
}

/** True if `layer` sits in group `groupId`, directly or in a nested group. Null means the top level, which holds everything. */
export function layerIsIn(groups: readonly Group[], layer: Layer, groupId: string | null): boolean {
  if (groupId === null) return true;
  return groupChain(groups, layer.groupId).some((g) => g.id === groupId);
}

/** The first and last stack index of a group's layers, or null if it has none. */
export function groupSpan(sprite: Sprite, groupId: string): [number, number] | null {
  let lo = -1;
  let hi = -1;
  sprite.layers.forEach((l, i) => {
    if (!layerIsIn(sprite.groups, l, groupId)) return;
    if (lo < 0) lo = i;
    hi = i;
  });
  return lo < 0 ? null : [lo, hi];
}

export function itemSpan(sprite: Sprite, item: StackItem): [number, number] | null {
  if (item.kind === 'group') return groupSpan(sprite, item.id);
  const i = sprite.layers.findIndex((l) => l.id === item.id);
  return i < 0 ? null : [i, i];
}

export function itemParent(sprite: Sprite, item: StackItem): string | null {
  if (item.kind === 'layer') return sprite.layers.find((l) => l.id === item.id)?.groupId ?? null;
  return sprite.groups.find((g) => g.id === item.id)?.parentId ?? null;
}

function setItemParent(sprite: Sprite, item: StackItem, parent: string | null): void {
  if (item.kind === 'layer') {
    const layer = sprite.layers.find((l) => l.id === item.id);
    if (layer) layer.groupId = parent;
  } else {
    const group = sprite.groups.find((g) => g.id === item.id);
    if (group) group.parentId = parent;
  }
}

/** The direct child of `parent` that holds `layer`: the layer itself, or a group. */
function childOf(sprite: Sprite, layer: Layer, parent: string | null): StackItem {
  const chain = groupChain(sprite.groups, layer.groupId);
  const at = parent === null ? -1 : chain.findIndex((g) => g.id === parent);
  const next = chain[at + 1];
  return next ? { kind: 'group', id: next.id } : { kind: 'layer', id: layer.id };
}

/** Drops groups that no longer hold any layer (directly or through nested groups). */
export function pruneGroups(sprite: Sprite): void {
  const byId = new Map(sprite.groups.map((g) => [g.id, g]));
  const used = new Set<string>();
  for (const l of sprite.layers) {
    for (let id = l.groupId; id && !used.has(id); id = byId.get(id)?.parentId ?? null) used.add(id);
  }
  const kept = sprite.groups.filter((g) => used.has(g.id));
  if (kept.length !== sprite.groups.length) sprite.groups.splice(0, sprite.groups.length, ...kept);
}

/**
 * Moves an item one step up (+1, toward the top) or down (-1), the way layer
 * panels do:
 * - at the edge of its group, it steps out of the group;
 * - a layer next to a sibling group steps into it;
 * - otherwise it swaps with the sibling next to it (a whole group moves as one).
 * Returns false if it can't move.
 */
export function moveItem(sprite: Sprite, item: StackItem, delta: 1 | -1): boolean {
  const span = itemSpan(sprite, item);
  if (!span) return false;
  const [lo, hi] = span;
  const parent = itemParent(sprite, item);
  const layers = sprite.layers;
  const n = delta > 0 ? hi + 1 : lo - 1;
  const neighbor = layers[n];
  const grandparent = parent
    ? (sprite.groups.find((g) => g.id === parent)?.parentId ?? null)
    : null;

  if (!neighbor || !layerIsIn(sprite.groups, neighbor, parent)) {
    if (parent === null) return false;
    setItemParent(sprite, item, grandparent);
    return true;
  }
  const sibling = childOf(sprite, neighbor, parent);
  if (item.kind === 'layer' && sibling.kind === 'group') {
    setItemParent(sprite, item, sibling.id);
    return true;
  }
  const [slo, shi] = itemSpan(sprite, sibling)!;
  const block = layers.splice(lo, hi - lo + 1);
  // After removing the block, the sibling's span shifts down if it was above.
  const at = delta > 0 ? shi - block.length + 1 : slo;
  layers.splice(at, 0, ...block);
  return true;
}

/** Puts `item` in a new group that takes its place. */
export function wrapInGroup(sprite: Sprite, item: StackItem, group: Group): void {
  group.parentId = itemParent(sprite, item);
  sprite.groups.push(group);
  setItemParent(sprite, item, group.id);
}

/** Removes a group, moving what was in it up to the group's own parent. */
export function ungroup(sprite: Sprite, groupId: string): void {
  const group = sprite.groups.find((g) => g.id === groupId);
  if (!group) return;
  for (const l of sprite.layers) if (l.groupId === groupId) l.groupId = group.parentId;
  for (const g of sprite.groups) if (g.parentId === groupId) g.parentId = group.parentId;
  sprite.groups.splice(sprite.groups.indexOf(group), 1);
}

/** Everything about the stack's structure, for undo. */
export interface StackSnapshot {
  layers: Layer[];
  groupIds: (string | null)[];
  groups: Group[];
  parents: (string | null)[];
}

export function snapshotStack(sprite: Sprite): StackSnapshot {
  return {
    layers: [...sprite.layers],
    groupIds: sprite.layers.map((l) => l.groupId),
    groups: [...sprite.groups],
    parents: sprite.groups.map((g) => g.parentId),
  };
}

/** Restores a snapshot in place (other code holds on to the arrays). */
export function restoreStack(sprite: Sprite, s: StackSnapshot): void {
  sprite.layers.splice(0, sprite.layers.length, ...s.layers);
  s.layers.forEach((l, i) => (l.groupId = s.groupIds[i]));
  sprite.groups.splice(0, sprite.groups.length, ...s.groups);
  s.groups.forEach((g, i) => (g.parentId = s.parents[i]));
}

/** A row of the layer list, top of the stack first. */
export type StackRow<L = Layer, G = Group> =
  { kind: 'group'; group: G; depth: number } | { kind: 'layer'; layer: L; depth: number };

/**
 * The layer list as panels show it: top layer first, each group as a row
 * above its contents, nested rows indented by `depth`. Contents of collapsed
 * groups are left out.
 */
export function stackRows<L extends { groupId: string | null }, G extends GroupLike>(
  layers: readonly L[],
  groups: readonly G[],
): StackRow<L, G>[] {
  const rows: StackRow<L, G>[] = [];
  let open: G[] = [];
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const chain = groupChain(groups, layer.groupId);
    let keep = 0;
    while (keep < open.length && keep < chain.length && open[keep] === chain[keep]) keep++;
    open = open.slice(0, keep);
    for (let d = keep; d < chain.length; d++) {
      open.push(chain[d]);
      if (!chain.slice(0, d).some((g) => g.collapsed)) {
        rows.push({ kind: 'group', group: chain[d], depth: d });
      }
    }
    if (!chain.some((g) => g.collapsed)) rows.push({ kind: 'layer', layer, depth: chain.length });
  }
  return rows;
}
