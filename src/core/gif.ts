import { alpha, blue, green, red, type Color } from './color';
import { quantize } from './quantize';

export interface GifFrame {
  /** Flattened RGBA pixels, `width × height`. */
  pixels: Uint32Array;
  delayMs: number;
}

export interface GifOptions {
  /** Integer upscale factor (nearest neighbor). Default 1. */
  scale?: number;
  /** Times to repeat; 0 loops forever (default). */
  loop?: number;
}

/** Pixels with less alpha than this become fully transparent; GIF has 1-bit alpha. */
const ALPHA_THRESHOLD = 128;
const opaque = (c: Color) => (c | 0xff000000) >>> 0;

class ByteWriter {
  private buf = new Uint8Array(1 << 16);
  length = 0;

  private grow(n: number) {
    if (this.length + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }

  byte(b: number) {
    this.grow(1);
    this.buf[this.length++] = b;
  }

  word(w: number) {
    this.byte(w & 255);
    this.byte((w >> 8) & 255);
  }

  bytes(data: ArrayLike<number>) {
    this.grow(data.length);
    this.buf.set(data, this.length);
    this.length += data.length;
  }

  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }

  result(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

/** GIF-flavored LZW, output as 255-byte sub-blocks. */
function writeLzw(out: ByteWriter, indices: Uint8Array, minCodeSize: number): void {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  const dict = new Map<number, number>();

  const block = new Uint8Array(255);
  let blockLen = 0;
  let bitBuf = 0;
  let bitCount = 0;
  const flushByte = (b: number) => {
    block[blockLen++] = b;
    if (blockLen === 255) {
      out.byte(255);
      out.bytes(block);
      blockLen = 0;
    }
  };
  const emit = (code: number) => {
    bitBuf |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      flushByte(bitBuf & 255);
      bitBuf >>>= 8;
      bitCount -= 8;
    }
  };

  out.byte(minCodeSize);
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      dict.clear();
      codeSize = minCodeSize + 1;
      next = eoi + 1;
    } else {
      if (next >= 1 << codeSize) codeSize++;
      dict.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bitCount > 0) flushByte(bitBuf & 255);
  if (blockLen > 0) {
    out.byte(blockLen);
    out.bytes(block.subarray(0, blockLen));
  }
  out.byte(0);
}

/**
 * Encodes frames as an animated GIF89a with one shared palette. Colors are
 * kept exactly when there are at most 255 (plus transparency); otherwise they
 * are reduced with median cut.
 */
export function encodeGif(
  width: number,
  height: number,
  frames: GifFrame[],
  options: GifOptions = {},
): Uint8Array {
  if (frames.length === 0) throw new RangeError('A GIF needs at least one frame.');
  const scale = Math.max(1, Math.floor(options.scale ?? 1));
  const outW = width * scale;
  const outH = height * scale;
  if (outW > 65535 || outH > 65535) throw new RangeError('GIF is too large.');

  // Gather colors (with usage counts, for better quantization).
  const counts = new Map<Color, number>();
  let hasTransparency = false;
  for (const f of frames) {
    for (const c of f.pixels) {
      if (alpha(c) < ALPHA_THRESHOLD) {
        hasTransparency = true;
        continue;
      }
      const o = opaque(c);
      counts.set(o, (counts.get(o) ?? 0) + 1);
    }
  }

  const slots = hasTransparency ? 255 : 256;
  const { palette, lookup } = quantize(counts, slots);
  const offset = hasTransparency ? 1 : 0; // index 0 is transparent
  const used = palette.length + offset;
  let bits = 1;
  while (1 << bits < Math.max(2, used)) bits++;
  const tableSize = 1 << bits;

  const out = new ByteWriter();
  out.ascii('GIF89a');
  out.word(outW);
  out.word(outH);
  out.byte(0x80 | (7 << 4) | (bits - 1)); // global table, 8-bit color resolution
  out.byte(0); // background index
  out.byte(0); // pixel aspect ratio

  for (let i = 0; i < tableSize; i++) {
    const c = i >= offset && i - offset < palette.length ? palette[i - offset] : 0;
    out.byte(red(c));
    out.byte(green(c));
    out.byte(blue(c));
  }

  if (frames.length > 1) {
    out.bytes([0x21, 0xff, 0x0b]);
    out.ascii('NETSCAPE2.0');
    out.bytes([0x03, 0x01]);
    out.word(options.loop ?? 0);
    out.byte(0);
  }

  const indices = new Uint8Array(outW * outH);
  const minCodeSize = Math.max(2, bits);
  for (const f of frames) {
    for (let y = 0; y < outH; y++) {
      const row = Math.floor(y / scale) * width;
      for (let x = 0; x < outW; x++) {
        const c = f.pixels[row + Math.floor(x / scale)];
        indices[y * outW + x] = alpha(c) < ALPHA_THRESHOLD ? 0 : lookup.get(opaque(c))! + offset;
      }
    }

    // Graphic control: restore to background before the next frame, so
    // transparent areas don't show the previous frame through.
    const delay = Math.max(2, Math.round(f.delayMs / 10));
    out.bytes([0x21, 0xf9, 0x04, (2 << 2) | (hasTransparency ? 1 : 0)]);
    out.word(delay);
    out.byte(0);
    out.byte(0);

    out.byte(0x2c);
    out.word(0);
    out.word(0);
    out.word(outW);
    out.word(outH);
    out.byte(0); // no local table, not interlaced
    writeLzw(out, indices, minCodeSize);
  }

  out.byte(0x3b);
  return out.result();
}
