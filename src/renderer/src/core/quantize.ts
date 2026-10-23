import { blue, green, red, rgba, type Color } from './color';

/**
 * Reduces a set of opaque colors to at most `max` colors using median cut.
 * Returns the palette and a lookup from each input color to its palette index.
 */
export function quantize(
  colors: Map<Color, number>,
  max: number,
): { palette: Color[]; lookup: Map<Color, number> } {
  const entries = [...colors.entries()];
  if (entries.length <= max) {
    return {
      palette: entries.map(([c]) => c),
      lookup: new Map(entries.map(([c], i) => [c, i])),
    };
  }

  type Box = [Color, number][];
  const channels = [red, green, blue];
  const range = (box: Box) =>
    channels.map((ch) => {
      let lo = 255;
      let hi = 0;
      for (const [c] of box) {
        const v = ch(c);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      return hi - lo;
    });

  const boxes: Box[] = [entries];
  while (boxes.length < max) {
    // Split the box with the widest channel range.
    let best = -1;
    let bestRange = 0;
    let bestChannel = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const r = range(box);
      const ch = r.indexOf(Math.max(...r));
      if (r[ch] > bestRange) {
        best = i;
        bestRange = r[ch];
        bestChannel = ch;
      }
    });
    if (best < 0) break;
    const box = boxes[best].sort(
      (a, b) => channels[bestChannel](a[0]) - channels[bestChannel](b[0]),
    );
    // Split at the weighted median so heavily used colors keep precision.
    const total = box.reduce((n, [, count]) => n + count, 0);
    let acc = 0;
    let cut = 1;
    for (; cut < box.length - 1; cut++) {
      acc += box[cut - 1][1];
      if (acc >= total / 2) break;
    }
    boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
  }

  const palette: Color[] = [];
  const lookup = new Map<Color, number>();
  boxes.forEach((box, i) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const [c, count] of box) {
      r += red(c) * count;
      g += green(c) * count;
      b += blue(c) * count;
      n += count;
      lookup.set(c, i);
    }
    palette.push(rgba(Math.round(r / n), Math.round(g / n), Math.round(b / n)));
  });
  return { palette, lookup };
}
