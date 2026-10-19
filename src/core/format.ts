import { fromHex, toHex, type Color } from './color';
import { assertValidSize, createLayer, DEFAULT_FRAME_MS, type Sprite } from './sprite';
import { cleanTag, type Tag } from './tags';

/**
 * The `.raster` project format: UTF-8 JSON. Cel pixels are raw RGBA bytes,
 * row-major from the top-left, base64 encoded. See docs/file-format.md.
 */
export const FILE_EXTENSION = '.raster';
export const FORMAT_VERSION = 4;
export const MAX_FRAMES = 1000;

interface LayerJson {
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  /**
   * v2+: one entry per frame. v3: `{ link: n }` reuses frame n's cel (an
   * earlier frame of the same layer).
   */
  cels?: (string | { link: number })[];
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
  layers: LayerJson[];
}

export interface Project {
  sprite: Sprite;
  palette: Color[];
  /** Indexed color mode (pixels limited to the palette). */
  indexed?: boolean;
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

export function serializeProject({ sprite, palette, indexed }: Project): string {
  const file: RasterFileJson = {
    format: 'raster',
    version: FORMAT_VERSION,
    width: sprite.width,
    height: sprite.height,
    palette: palette.map((c) => toHex(c)),
    frames: sprite.frames.map((f) => ({ duration: f.duration })),
    tags: sprite.tags.map(({ name, from, to }) => ({ name, from, to })),
    colorMode: indexed ? 'indexed' : 'rgb',
    layers: sprite.layers.map((l) => ({
      name: l.name,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      cels: l.cels.map((c, f) => {
        const first = l.cels.indexOf(c);
        if (first < f) return { link: first };
        return toBase64(new Uint8Array(c.buffer, c.byteOffset, c.byteLength));
      }),
    })),
  };
  return JSON.stringify(file);
}

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

  const layers = json.layers.map((l, i) => {
    const layer = createLayer(width, height, String(l.name ?? `Layer ${i + 1}`), frames.length);
    const cels = json.version >= 2 ? l.cels : [l.data];
    if (!Array.isArray(cels) || cels.length !== frames.length) {
      throw new FormatError(`Layer "${layer.name}" needs one cel per frame.`);
    }
    cels.forEach((data, f) => {
      if (typeof data === 'object' && data !== null) {
        const link = data.link;
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
    });
    layer.visible = l.visible !== false;
    layer.locked = l.locked === true;
    layer.opacity = Math.min(1, Math.max(0, Number(l.opacity ?? 1)));
    layer.pixels = layer.cels[0];
    return layer;
  });

  const tags = (Array.isArray(json.tags) ? json.tags : [])
    .filter((t) => t && Number.isFinite(t.from) && Number.isFinite(t.to))
    .map((t) => cleanTag(t, frames.length));

  const palette = (Array.isArray(json.palette) ? json.palette : [])
    .map((h) => fromHex(String(h)))
    .filter((c): c is Color => c !== null);

  return {
    sprite: { width, height, layers, frames, tags },
    palette,
    indexed: json.colorMode === 'indexed',
  };
}
