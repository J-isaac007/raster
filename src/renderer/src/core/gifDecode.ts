import { rgba, TRANSPARENT } from './color';
import type { GifFrame } from './gif';

export interface DecodedGif {
  width: number;
  height: number;
  /** Fully composited frames, each `width × height`. */
  frames: GifFrame[];
}

export class GifError extends Error {
  override name = 'GifError';
}

function lzwDecode(data: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
  const out = new Uint8Array(pixelCount);
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  // Each code is stored as (prefix code, last byte, length).
  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const length = new Uint16Array(4096);
  for (let i = 0; i < clear; i++) {
    prefix[i] = -1;
    suffix[i] = i;
    length[i] = 1;
  }

  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let prev = -1;
  let written = 0;
  let bitBuf = 0;
  let bitCount = 0;
  let pos = 0;

  const firstByte = (code: number) => {
    while (prefix[code] >= 0) code = prefix[code];
    return suffix[code];
  };
  const writeCode = (code: number) => {
    const len = length[code];
    let end = written + len;
    if (end > pixelCount) end = pixelCount;
    for (let i = written + len - 1, c = code; c >= 0; i--, c = prefix[c]) {
      if (i < end) out[i] = suffix[c];
    }
    written += len;
  };

  while (written < pixelCount) {
    while (bitCount < codeSize) {
      if (pos >= data.length) return out;
      bitBuf |= data[pos++] << bitCount;
      bitCount += 8;
    }
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>>= codeSize;
    bitCount -= codeSize;

    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = eoi + 1;
      prev = -1;
      continue;
    }
    if (code === eoi) break;
    if (prev < 0) {
      if (code >= clear) throw new GifError('Corrupt GIF data.');
      writeCode(code);
      prev = code;
      continue;
    }
    if (code > next) throw new GifError('Corrupt GIF data.');
    const known = code < next;
    if (next < 4096) {
      prefix[next] = prev;
      suffix[next] = firstByte(known ? code : prev);
      length[next] = length[prev] + 1;
      next++;
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
    }
    writeCode(code);
    prev = code;
  }
  return out;
}

/** Decodes a GIF (static or animated) into composited RGBA frames. */
export function decodeGif(bytes: Uint8Array): DecodedGif {
  let p = 0;
  const need = (n: number) => {
    if (p + n > bytes.length) throw new GifError('GIF file is truncated.');
  };
  const byte = () => {
    need(1);
    return bytes[p++];
  };
  const word = () => byte() | (byte() << 8);
  const readTable = (size: number) => {
    need(size * 3);
    const table = new Uint32Array(size);
    for (let i = 0; i < size; i++) table[i] = rgba(bytes[p++], bytes[p++], bytes[p++]);
    return table;
  };
  const readSubBlocks = () => {
    const parts: Uint8Array[] = [];
    let total = 0;
    for (let len = byte(); len > 0; len = byte()) {
      need(len);
      parts.push(bytes.subarray(p, p + len));
      p += len;
      total += len;
    }
    const data = new Uint8Array(total);
    let o = 0;
    for (const part of parts) {
      data.set(part, o);
      o += part.length;
    }
    return data;
  };

  const sig = String.fromCharCode(...bytes.subarray(0, 6));
  if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new GifError('Not a GIF file.');
  p = 6;
  const width = word();
  const height = word();
  if (width === 0 || height === 0) throw new GifError('GIF has no pixels.');
  const flags = byte();
  p += 2; // background index, aspect ratio
  const globalTable = flags & 0x80 ? readTable(1 << ((flags & 7) + 1)) : null;

  const canvas = new Uint32Array(width * height);
  const frames: GifFrame[] = [];
  let delayMs = 100;
  let transparent = -1;
  let disposal = 0;

  for (;;) {
    const block = byte();
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = byte();
      if (label === 0xf9) {
        byte(); // block size (4)
        const packed = byte();
        const delay = word();
        const index = byte();
        byte(); // terminator
        disposal = (packed >> 2) & 7;
        transparent = packed & 1 ? index : -1;
        delayMs = delay ? delay * 10 : 100;
      } else {
        readSubBlocks();
      }
      continue;
    }
    if (block !== 0x2c) throw new GifError('Unexpected data in GIF.');

    const fx = word();
    const fy = word();
    const fw = word();
    const fh = word();
    const iflags = byte();
    const table = iflags & 0x80 ? readTable(1 << ((iflags & 7) + 1)) : globalTable;
    if (!table) throw new GifError('GIF frame has no color table.');
    const interlaced = (iflags & 0x40) !== 0;
    const minCodeSize = byte();
    if (minCodeSize < 1 || minCodeSize > 11) throw new GifError('Corrupt GIF data.');
    const indices = lzwDecode(readSubBlocks(), minCodeSize, fw * fh);

    const before = disposal === 3 ? canvas.slice() : null;

    // Interlaced rows arrive in passes: every 8th from 0, every 8th from 4,
    // every 4th from 2, every 2nd from 1.
    const rowOrder: number[] = [];
    if (interlaced) {
      for (const [start, step] of [
        [0, 8],
        [4, 8],
        [2, 4],
        [1, 2],
      ]) {
        for (let r = start; r < fh; r += step) rowOrder.push(r);
      }
    }
    for (let i = 0; i < fh; i++) {
      const y = fy + (interlaced ? rowOrder[i] : i);
      if (y >= height) continue;
      for (let x = 0; x < fw; x++) {
        const cx = fx + x;
        if (cx >= width) continue;
        const idx = indices[i * fw + x];
        if (idx === transparent) continue;
        canvas[y * width + cx] = table[idx] ?? TRANSPARENT;
      }
    }

    frames.push({ pixels: canvas.slice(), delayMs });

    if (disposal === 2) {
      for (let y = fy; y < Math.min(height, fy + fh); y++) {
        canvas.fill(TRANSPARENT, y * width + fx, y * width + Math.min(width, fx + fw));
      }
    } else if (disposal === 3 && before) {
      canvas.set(before);
    }
    delayMs = 100;
    transparent = -1;
    disposal = 0;
  }

  if (frames.length === 0) throw new GifError('GIF has no frames.');
  return { width, height, frames };
}
