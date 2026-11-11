import { celOpacity, setCelOpacity } from './cels';
import { fromHex, isBlendMode, toHex, type BlendMode, type Color } from './color';
import {
  assertValidSize,
  createGroup,
  createLayer,
  DEFAULT_FRAME_MS,
  type Group,
  type Sprite,
} from './sprite';
import { pruneGroups } from './groups';
import { cleanTag, type Tag } from './tags';

/**
 * The `.raster` project format: UTF-8 JSON. Cel pixels are raw RGBA bytes,
 * row-major from the top-left, base64 encoded. See docs/file-format.md.
 */
export const FILE_EXTENSION = '.raster';
export const FORMAT_VERSION = 6;
export const MAX_RECENT_COLORS = 16;
export const MAX_FRAMES = 1000;

interface LayerJson {
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  /** v6+. Absent means `normal`. */
  blendMode?: BlendMode;
  /** v6+. A reference layer: shown, never exported. */
  reference?: boolean;
  /** v6+. Index into `groups`, or null/absent at the top level. */
  group?: number | null;
  /**
   * v2+: one entry per frame. v3: `{ link: n }` reuses frame n's cel (an
   * earlier frame of the same layer). v6: `{ data, opacity }` is a cel with
   * its own opacity.
   */
  cels?: (string | { link: number } | { data: string; opacity: number })[];
  /** v1: the only image. */
  data?: string;
}

interface RasterFileJson {
  format: 'raster';
  version: number;
  width: number;
  height: number;
  palette: string[];
  /** v2+. */
  frames?: { duration: number }[];
  /** v3+. */
  tags?: Tag[];
  /** v4+. Absent means `rgb`. */
  colorMode?: 'rgb' | 'indexed';
  /** v5+. Recently used drawing colors, newest first. */
  recentColors?: string[];
  /** v6+. Layer groups; `parent` is an index into this list. */
  groups?: GroupJson[];
  layers: LayerJson[];
}

interface GroupJson {
  name: string;
  parent: number | null;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  collapsed: boolean;
}

export interface Project {
  sprite: Sprite;
  palette: Color[];
  /** Indexed color mode (pixels limited to the palette). */
  indexed?: boolean;
  /** Recently used drawing colors, newest first, at most `MAX_RECENT_COLORS`. */
  recentColors?: Color[];
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function fromBase64(text: string): Uint8Array {
  let bin: string;
  try {
    bin = atob(text);
  } catch {
    throw new FormatError('Pixel data is not valid base64.');
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function serializeProject({ sprite, palette, indexed, recentColors }: Project): string {
  const groupIndex = new Map(sprite.groups.map((g, i) => [g.id, i]));
  const file: RasterFileJson = {
    format: 'raster',
    version: FORMAT_VERSION,
    width: sprite.width,
    height: sprite.height,
    palette: palette.map((c) => toHex(c)),
    frames: sprite.frames.map((f) => ({ duration: f.duration })),
    tags: sprite.tags.map(({ name, from, to }) => ({ name, from, to })),
    colorMode: indexed ? 'indexed' : 'rgb',
    recentColors: (recentColors ?? []).map((c) => toHex(c)),
    groups: sprite.groups.map((g) => ({
      name: g.name,
      parent: g.parentId ? (groupIndex.get(g.parentId) ?? null) : null,
      visible: g.visible,
      opacity: g.opacity,
      blendMode: g.blendMode,
      collapsed: g.collapsed,
    })),
    layers: sprite.layers.map((l) => ({
      name: l.name,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      blendMode: l.blendMode,
      reference: l.reference,
      group: l.groupId ? (groupIndex.get(l.groupId) ?? null) : null,
      cels: l.cels.map((c, f) => {
        const first = l.cels.indexOf(c);
        if (first < f) return { link: first };
        const data = toBase64(new Uint8Array(c.buffer, c.byteOffset, c.byteLength));
        const opacity = celOpacity(c);
        return opacity === 1 ? data : { data, opacity };
      }),
    })),
  };
  return JSON.stringify(file);
}

/** Reads the v6 group list; bad parents (missing, or forming a loop) become top level. */
function parseGroups(list: unknown): Group[] {
  if (!Array.isArray(list)) return [];
  const groups = list.map((g: Partial<GroupJson> | null, i) => {
    const group = createGroup(String(g?.name ?? `Group ${i + 1}`));
    group.visible = g?.visible !== false;
    group.opacity = Math.min(1, Math.max(0, Number(g?.opacity ?? 1)));
    group.blendMode = isBlendMode(g?.blendMode) ? g.blendMode : 'normal';
    group.collapsed = g?.collapsed === true;
    return group;
  });
  list.forEach((g: Partial<GroupJson> | null, i) => {
    const p = g?.parent;
    if (Number.isInteger(p) && p !== i && groups[p as number])
      groups[i].parentId = groups[p as number].id;
  });
  // Break parent loops.
  const byId = new Map(groups.map((g) => [g.id, g]));
  for (const g of groups) {
    const seen = new Set<string>([g.id]);
    for (let p = g.parentId; p; p = byId.get(p)?.parentId ?? null) {
      if (seen.has(p)) {
        g.parentId = null;
        break;
      }
      seen.add(p);
    }
  }
  return groups;
}

const withPrunedGroups = (sprite: Sprite): Sprite => {
  pruneGroups(sprite);
  return sprite;
};

export class FormatError extends Error {
  override name = 'FormatError';
}

export function parseProject(text: string): Project {
  let json: RasterFileJson;
  try {
    json = JSON.parse(text);
  } catch {
    throw new FormatError('File is not valid JSON.');
  }
  if (json?.format !== 'raster') throw new FormatError('Not a Raster project file.');
  if (typeof json.version !== 'number' || json.version > FORMAT_VERSION) {
    throw new FormatError(`Unsupported file version ${json.version}. Update Raster to open it.`);
  }
  const { width, height } = json;
  try {
    assertValidSize(width, height);
  } catch (e) {
    throw new FormatError((e as Error).message);
  }
  if (!Array.isArray(json.layers) || json.layers.length === 0) {
    throw new FormatError('Project has no layers.');
  }

  const frames = (json.version >= 2 && Array.isArray(json.frames) ? json.frames : [{}]).map(
    (f: { duration?: number }) => ({
      duration: Math.max(10, Math.round(Number(f?.duration) || DEFAULT_FRAME_MS)),
    }),
  );
  if (frames.length === 0 || frames.length > MAX_FRAMES) {
    throw new FormatError(`Projects need 1 to ${MAX_FRAMES} frames.`);
  }

  const groups = parseGroups(json.version >= 6 ? json.groups : undefined);

  const layers = json.layers.map((l, i) => {
    const layer = createLayer(width, height, String(l.name ?? `Layer ${i + 1}`), frames.length);
    const cels = json.version >= 2 ? l.cels : [l.data];
    if (!Array.isArray(cels) || cels.length !== frames.length) {
      throw new FormatError(`Layer "${layer.name}" needs one cel per frame.`);
    }
    cels.forEach((entry, f) => {
      let data = entry;
      let opacity = 1;
      if (typeof entry === 'object' && entry !== null && 'data' in entry) {
        data = entry.data;
        opacity = Number(entry.opacity);
      } else if (typeof entry === 'object' && entry !== null) {
        const link = (entry as { link: number }).link;
        if (!Number.isInteger(link) || link < 0 || link >= f) {
          throw new FormatError(`Layer "${layer.name}" has a bad cel link.`);
        }
        layer.cels[f] = layer.cels[link];
        return;
      }
      const bytes = fromBase64(String(data ?? ''));
      if (bytes.length !== width * height * 4) {
        throw new FormatError(`Layer "${layer.name}" has the wrong amount of pixel data.`);
      }
      new Uint8Array(layer.cels[f].buffer).set(bytes);
      if (Number.isFinite(opacity) && opacity !== 1) setCelOpacity(layer.cels[f], opacity);
    });
    layer.visible = l.visible !== false;
    layer.locked = l.locked === true;
    layer.opacity = Math.min(1, Math.max(0, Number(l.opacity ?? 1)));
    layer.blendMode = isBlendMode(l.blendMode) ? l.blendMode : 'normal';
    layer.reference = l.reference === true;
    layer.groupId = Number.isInteger(l.group) ? (groups[l.group as number]?.id ?? null) : null;
    layer.pixels = layer.cels[0];
    return layer;
  });

  const tags = (Array.isArray(json.tags) ? json.tags : [])
    .filter((t) => t && Number.isFinite(t.from) && Number.isFinite(t.to))
    .map((t) => cleanTag(t, frames.length));

  const palette = (Array.isArray(json.palette) ? json.palette : [])
    .map((h) => fromHex(String(h)))
    .filter((c): c is Color => c !== null);

  const recentColors = (
    json.version >= 5 && Array.isArray(json.recentColors) ? json.recentColors : []
  )
    .map((h) => fromHex(String(h)))
    .filter((c, i, all): c is Color => c !== null && all.indexOf(c) === i)
    .slice(0, MAX_RECENT_COLORS);

  return {
    sprite: withPrunedGroups({ width, height, layers, groups, frames, tags }),
    palette,
    indexed: json.colorMode === 'indexed',
    recentColors,
  };
}
