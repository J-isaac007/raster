import { describe, expect, it } from 'vitest';
import { alpha } from './color';
import { DEFAULT_PALETTE } from './palette';
import { BUILTIN_PALETTES, builtinPalette, PALETTE_GROUPS } from './palettes';

describe('built-in palettes', () => {
  it('have unique ids, credits and opaque colors', () => {
    const ids = new Set(BUILTIN_PALETTES.map((p) => p.id));
    expect(ids.size).toBe(BUILTIN_PALETTES.length);
    for (const p of BUILTIN_PALETTES) {
      expect(p.name).not.toBe('');
      expect(p.author).not.toBe('');
      expect(PALETTE_GROUPS).toContain(p.group);
      expect(p.colors.length).toBeGreaterThan(1);
      expect(p.colors.length).toBeLessThanOrEqual(256);
      for (const c of p.colors) expect(alpha(c)).toBe(255);
    }
  });

  it('start new sprites on PICO-8', () => {
    expect(DEFAULT_PALETTE).toEqual([...builtinPalette('pico-8')!.colors]);
    expect(DEFAULT_PALETTE).toHaveLength(16);
  });

  it('generate grayscale ramps from black to white', () => {
    const g = builtinPalette('grayscale-4')!;
    expect(g.colors.map((c) => c >>> 0)).toHaveLength(4);
    expect(g.source).toBeNull();
  });
});
