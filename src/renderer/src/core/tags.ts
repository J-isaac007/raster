/**
 * A named range of frames, such as "walk" or "idle": one animation loop in a
 * sprite. `from` and `to` are frame indices, both included.
 */
export interface Tag {
  name: string;
  from: number;
  to: number;
}

export const MAX_TAG_NAME = 64;

/** The tag that `frame` plays in: the shortest one containing it, or null. */
export function tagAt(tags: readonly Tag[], frame: number): Tag | null {
  let best: Tag | null = null;
  for (const t of tags) {
    if (frame < t.from || frame > t.to) continue;
    if (!best || t.to - t.from < best.to - best.from) best = t;
  }
  return best;
}

/** The frame after `frame` during playback: loops inside `tag`, or the whole animation. */
export function nextPlaybackFrame(frame: number, frameCount: number, tag: Tag | null): number {
  if (tag && frame >= tag.from && frame <= tag.to) return frame >= tag.to ? tag.from : frame + 1;
  return (frame + 1) % frameCount;
}

/**
 * Tags after a frame is inserted at `index`. Tags after it shift right; a tag
 * the new frame lands inside, or right after, grows to include it.
 */
export function tagsAfterInsert(tags: readonly Tag[], index: number): Tag[] {
  return tags.map((t) => {
    if (t.from >= index) return { ...t, from: t.from + 1, to: t.to + 1 };
    if (t.to + 1 >= index) return { ...t, to: t.to + 1 };
    return t;
  });
}

/** Tags after the frame at `index` is deleted. Tags left with no frames are removed. */
export function tagsAfterDelete(tags: readonly Tag[], index: number): Tag[] {
  return tags.flatMap((t) => {
    if (t.from > index) return [{ ...t, from: t.from - 1, to: t.to - 1 }];
    if (t.to < index) return [t];
    return t.from === t.to ? [] : [{ ...t, to: t.to - 1 }];
  });
}

/** A tag with a tidy name and a frame range that fits `frameCount` frames. */
export function cleanTag(tag: Tag, frameCount: number): Tag {
  const clamp = (n: number) => Math.min(frameCount - 1, Math.max(0, Math.round(n) || 0));
  const a = clamp(tag.from);
  const b = clamp(tag.to);
  const name = String(tag.name ?? '')
    .trim()
    .slice(0, MAX_TAG_NAME);
  return { name: name || 'Tag', from: Math.min(a, b), to: Math.max(a, b) };
}
