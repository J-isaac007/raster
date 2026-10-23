import { alpha, type Color } from '@core/color';
import { applyPatch, type PixelPatch } from '@core/history';
import { nearestColor, paletteRemap, paletteSnapper, recolorPixels } from '@core/palette';
import { uniqueCels, type Surface } from '@core/sprite';
import type { EditorCore } from './core';
import type { EditorState } from './state';

type PaletteState = Pick<EditorState, 'palette' | 'indexed' | 'primary' | 'secondary'>;

/**
 * The palette, palette swaps and indexed color mode. In indexed mode every
 * pixel, drawing color and paste is snapped to a palette color, and palette
 * changes carry the pixels along with them.
 */
export class EditorPalette {
  constructor(private readonly core: EditorCore) {}

  /** `c` snapped to the palette in indexed mode; unchanged otherwise. */
  snap(c: Color): Color {
    const { indexed, palette } = this.core.getState();
    return indexed ? nearestColor(c, palette) : c;
  }

  /** A pixel mapper for strokes: the palette snapper in indexed mode, else null. */
  snapper(): ((c: Color) => Color) | null {
    const { indexed, palette } = this.core.getState();
    return indexed ? paletteSnapper(palette) : null;
  }

  /** A copy of `surface` snapped to the palette in indexed mode. */
  snapSurface(surface: Surface): Surface {
    const snap = this.snapper();
    if (!snap) return surface;
    return { ...surface, pixels: surface.pixels.map(snap) };
  }

  /**
   * Replaces the palette. In indexed mode the pixels follow: a palette of the
   * same size swaps colors by index, otherwise removed colors snap to the
   * nearest remaining one.
   */
  setPalette(palette: Color[]): void {
    const s = this.core.getState();
    this.apply('Change Palette', { palette }, s.indexed ? paletteRemap(s.palette, palette) : null);
  }

  /**
   * Palette swap: sets entry `index` to `color` and recolors every pixel of the
   * old color, in all layers and frames, as one undo step.
   */
  setPaletteColor(index: number, color: Color): void {
    const s = this.core.getState();
    const old = s.palette[index];
    if (old === undefined || old === color) return;
    const palette = s.palette.with(index, color);
    const map = s.indexed
      ? paletteRemap(s.palette, palette)
      : alpha(old) === 0
        ? null
        : (c: Color) => (c === old ? color : c);
    this.apply('Swap Palette Color', { palette }, map);
  }

  /** Turns indexed mode on (snapping every pixel to the palette) or off. */
  setIndexed(indexed: boolean): void {
    const s = this.core.getState();
    if (s.indexed === indexed) return;
    if (indexed && s.palette.length === 0) {
      this.core.notify('Add colors to the palette first');
      return;
    }
    this.apply(
      indexed ? 'Indexed Color' : 'RGB Color',
      { indexed },
      indexed ? paletteSnapper(s.palette) : null,
    );
  }

  /**
   * Applies a palette state change, mapping every distinct cel (and the
   * drawing colors) through `map`, as one undo step. Locked and hidden layers
   * are included: the palette belongs to the whole document.
   */
  private apply(
    label: string,
    patch: Partial<PaletteState>,
    map: ((c: Color) => Color) | null,
  ): void {
    if (this.core.stroking) return;
    this.core.settle();
    const s = this.core.getState();
    const before: PaletteState = {
      palette: s.palette,
      indexed: s.indexed,
      primary: s.primary,
      secondary: s.secondary,
    };
    const after: PaletteState = {
      ...before,
      ...patch,
      primary: map ? map(s.primary) : s.primary,
      secondary: map ? map(s.secondary) : s.secondary,
    };
    const changes: [Uint32Array, PixelPatch][] = [];
    if (map) {
      for (const cel of uniqueCels(this.core.sprite)) {
        const p = recolorPixels(cel, map);
        if (p) changes.push([cel, p]);
      }
    }
    // Drawing colors follow undo/redo unless the user has picked others since.
    const restore = (from: PaletteState, to: PaletteState) => {
      const { primary, secondary } = this.core.getState();
      this.core.stage({
        palette: to.palette,
        indexed: to.indexed,
        primary: primary === from.primary ? to.primary : primary,
        secondary: secondary === from.secondary ? to.secondary : secondary,
      });
    };
    this.core.stage(after);
    this.core.record({
      label,
      undo: () => {
        for (const [cel, p] of changes) applyPatch(cel, p, 'before');
        restore(after, before);
      },
      redo: () => {
        for (const [cel, p] of changes) applyPatch(cel, p, 'after');
        restore(before, after);
      },
    });
  }
}
