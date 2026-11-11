import { describe, expect, it } from 'vitest';
import { alpha, rgba, toHsl, type Color } from './color';
import { COOL_HUE, insertRamp, makeRamp, MAX_RAMP_STEPS, MIN_RAMP_STEPS, WARM_HUE } from './ramp';

/** Distance between two hues (0..1) around the wheel, 0..0.5. */
const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
};
const hue = (c: Color) => toHsl(c)[0];
const light = (c: Color) => toHsl(c)[2];

describe('makeRamp', () => {
  const ORANGE = rgba(204, 107, 51);
  const TEAL = rgba(40, 150, 140);

  it('makes the asked number of steps, clamped to the allowed range', () => {
    expect(makeRamp(ORANGE, { steps: 5 })).toHaveLength(5);
    expect(makeRamp(ORANGE, { steps: 8 })).toHaveLength(8);
    expect(makeRamp(ORANGE, { steps: 1 })).toHaveLength(MIN_RAMP_STEPS);
    expect(makeRamp(ORANGE, { steps: 99 })).toHaveLength(MAX_RAMP_STEPS);
  });

  it('runs from dark to light with the base color in it unchanged', () => {
    for (const base of [ORANGE, TEAL, rgba(30, 30, 80), rgba(240, 230, 200)]) {
      const ramp = makeRamp(base, { steps: 7 });
      expect(ramp).toContain(base);
      for (let i = 1; i < ramp.length; i++) {
        expect(light(ramp[i])).toBeGreaterThan(light(ramp[i - 1]));
      }
    }
  });

  it('keeps the base in the middle when there is room on both sides', () => {
    expect(makeRamp(ORANGE, { steps: 5, lightRange: 0.6 }).indexOf(ORANGE)).toBe(2);
  });

  it('turns darker steps toward blue and lighter steps toward yellow', () => {
    for (const base of [ORANGE, TEAL]) {
      const ramp = makeRamp(base, { steps: 5, hueShift: 30 });
      const b = ramp.indexOf(base);
      const darkest = ramp[0];
      const lightest = ramp[ramp.length - 1];
      expect(hueDistance(hue(darkest), COOL_HUE)).toBeLessThan(hueDistance(hue(base), COOL_HUE));
      expect(hueDistance(hue(lightest), WARM_HUE)).toBeLessThan(hueDistance(hue(base), WARM_HUE));
      // Steps farther from the base turn further.
      expect(hueDistance(hue(ramp[0]), hue(base))).toBeGreaterThan(
        hueDistance(hue(ramp[b - 1]), hue(base)),
      );
    }
  });

  it('turns by at most the hue shift', () => {
    const ramp = makeRamp(TEAL, { steps: 5, hueShift: 10 });
    for (const c of ramp) expect(hueDistance(hue(c), hue(TEAL)) * 360).toBeLessThanOrEqual(10.5);
  });

  it('keeps hue with no shift', () => {
    const ramp = makeRamp(TEAL, { steps: 5, hueShift: 0, saturationShift: 0 });
    for (const c of ramp) expect(hueDistance(hue(c), hue(TEAL)) * 360).toBeLessThan(3);
  });

  it('tints a gray: cool darks, warm lights', () => {
    const gray = rgba(128, 128, 128);
    const ramp = makeRamp(gray, { steps: 5, saturationShift: 0.2 });
    expect(hueDistance(hue(ramp[0]), COOL_HUE)).toBeLessThan(0.05);
    expect(toHsl(ramp[0])[1]).toBeGreaterThan(0);
  });

  it('keeps the base alpha', () => {
    const base = rgba(204, 107, 51, 128);
    for (const c of makeRamp(base)) expect(alpha(c)).toBe(128);
  });

  it('stays clear of pure black and white for very dark or light bases', () => {
    for (const base of [rgba(5, 5, 10), rgba(250, 250, 245)]) {
      const ramp = makeRamp(base, { steps: 5 });
      expect(new Set(ramp).size).toBe(5);
      expect(ramp).toContain(base);
    }
  });
});

describe('insertRamp', () => {
  const [A, B, C, D, E] = [1, 2, 3, 4, 5].map((n) => rgba(n, n, n));
  const ramp = [D, A, E]; // dark, base, light (any colors do)

  it('puts the ramp in place of the base, darker steps first', () => {
    expect(insertRamp([B, A, C], A, ramp, 256)).toEqual([B, D, A, E, C]);
  });

  it('puts the ramp at the end when the base is not in the palette', () => {
    expect(insertRamp([B, C], A, ramp, 256)).toEqual([B, C, D, A, E]);
  });

  it('drops repeats inside the ramp', () => {
    expect(insertRamp([B], A, [D, D, A, E, E], 256)).toEqual([B, D, A, E]);
  });

  it('leaves out the steps farthest from the base to stay under the cap', () => {
    const wide = [rgba(9, 0, 0), D, A, E, rgba(0, 9, 0)];
    expect(insertRamp([B, A, C], A, wide, 5)).toEqual([B, D, A, E, C]);
    expect(insertRamp([B, A, C], A, wide, 3)).toEqual([B, A, C]);
    expect(insertRamp([B, C], A, wide, 3)).toEqual([B, C, A]);
    expect(insertRamp([B, C], A, wide, 2)).toEqual([B, C]);
  });
});
