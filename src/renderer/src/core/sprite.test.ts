import { describe, expect, it } from 'vitest';
import { rgba } from './color';
import {
  celLinks,
  cloneLayer,
  composite,
  copyRect,
  createLayer,
  createSprite,
  flipPixels,
  mapCels,
  mergeInto,
  resizePixels,
  stamp,
  uniqueCels,
  type Sprite,
} from './sprite';

const RED = rgba(255, 0, 0);
const BLUE = rgba(0, 0, 255);

describe('createSprite', () => {
  it('starts with one transparent layer', () => {
    const s = createSprite(4, 3);
    expect(s.layers).toHaveLength(1);
    expect(s.layers[0].pixels).toHaveLength(12);
    expect(s.layers[0].pixels.every((p) => p === 0)).toBe(true);
  });

  it('rejects invalid sizes', () => {
    expect(() => createSprite(0, 4)).toThrow(RangeError);
    expect(() => createSprite(4.5, 4)).toThrow(RangeError);
    expect(() => createSprite(5000, 4)).toThrow(RangeError);
  });
});

describe('composite', () => {
  it('stacks visible layers bottom to top', () => {
    const s: Sprite = createSprite(2, 1);
    const top = createLayer(2, 1, 'top');
    s.layers[0].pixels.set([RED, RED]);
    top.pixels.set([BLUE, 0]);
    s.layers.push(top);
    expect([...composite(s)]).toEqual([BLUE, RED]);

    top.visible = false;
    expect([...composite(s)]).toEqual([RED, RED]);
  });

  it('applies layer opacity', () => {
    const s = createSprite(1, 1);
    s.layers[0].pixels[0] = RED;
    s.layers[0].opacity = 0.5;
    expect(composite(s)[0]).toBe(rgba(255, 0, 0, 128));
  });
});

describe('mergeInto', () => {
  it('blends the upper layer into the lower one', () => {
    const lower = createLayer(2, 1, 'a');
    const upper = createLayer(2, 1, 'b');
    lower.pixels.set([RED, RED]);
    upper.pixels.set([0, BLUE]);
    mergeInto(lower, upper);
    expect([...lower.pixels]).toEqual([RED, BLUE]);
  });
});

describe('flipPixels', () => {
  const make = () => ({ width: 3, height: 2, pixels: Uint32Array.from([1, 2, 3, 4, 5, 6]) });

  it('flips horizontally', () => {
    const s = make();
    flipPixels(s, 'horizontal');
    expect([...s.pixels]).toEqual([3, 2, 1, 6, 5, 4]);
  });

  it('flips vertically', () => {
    const s = make();
    flipPixels(s, 'vertical');
    expect([...s.pixels]).toEqual([4, 5, 6, 1, 2, 3]);
  });
});

describe('resizePixels', () => {
  const src = { width: 2, height: 2, pixels: Uint32Array.from([1, 2, 3, 4]) };

  it('grows with an offset', () => {
    expect([...resizePixels(src, 3, 3, 1, 1)]).toEqual([0, 0, 0, 0, 1, 2, 0, 3, 4]);
  });

  it('crops', () => {
    expect([...resizePixels(src, 1, 1, -1, -1)]).toEqual([4]);
  });
});

describe('copyRect and stamp', () => {
  it('copies an area, with transparency outside the source', () => {
    const src = {
      width: 2,
      height: 2,
      pixels: Uint32Array.of(1, 2, 3, 4).map((n) => n | 0xff000000),
    };
    const out = copyRect(src, { x: 1, y: -1, width: 2, height: 2 });
    expect([...out.pixels]).toEqual([0, 0, src.pixels[1], 0]);
  });

  it('stamps with blending and clipping', () => {
    const red = rgba(255, 0, 0);
    const dst = { width: 2, height: 1, pixels: Uint32Array.of(red, red) };
    stamp(dst, { width: 2, height: 1, pixels: Uint32Array.of(0, rgba(0, 0, 255)) }, 1, 0);
    expect([...dst.pixels]).toEqual([red, red]);
    stamp(dst, { width: 2, height: 1, pixels: Uint32Array.of(0, rgba(0, 0, 255)) }, 0, 0);
    expect([...dst.pixels]).toEqual([red, rgba(0, 0, 255)]);
  });
});

describe('linked cels', () => {
  it('reports which frames share a cel', () => {
    const layer = createLayer(1, 1, 'a', 4);
    layer.cels[2] = layer.cels[0];
    layer.cels[3] = layer.cels[1];
    expect(celLinks(layer.cels)).toEqual([0, 1, 0, 1]);
  });

  it('maps each shared cel once, keeping the links', () => {
    const layer = createLayer(1, 1, 'a', 3);
    layer.cels[1] = layer.cels[0];
    let calls = 0;
    const out = mapCels(layer.cels, (c) => (calls++, c.slice()));
    expect(calls).toBe(2);
    expect(out[1]).toBe(out[0]);
    expect(out[0]).not.toBe(layer.cels[0]);
  });

  it('keeps links when a layer is cloned', () => {
    const layer = createLayer(1, 1, 'a', 2);
    layer.cels[1] = layer.cels[0];
    const copy = cloneLayer(layer);
    expect(copy.cels[1]).toBe(copy.cels[0]);
    expect(copy.cels[0]).not.toBe(layer.cels[0]);
  });
});

describe('uniqueCels', () => {
  it('lists each buffer once, even when frames are linked', () => {
    const s = createSprite(2, 1, 3);
    s.layers[0].cels[2] = s.layers[0].cels[0];
    s.layers.push(createLayer(2, 1, 'top', 3));
    expect(uniqueCels(s)).toHaveLength(5);
  });
});
