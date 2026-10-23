import { toHex, type Color } from '@core/color';

/** A color over the transparency checkerboard; fills its parent (Figma: Swatch). */
export function Swatch({ color }: { color: Color }) {
  return (
    <span className="swatch checker">
      <span className="swatch-fill" style={{ background: toHex(color, true) }} />
    </span>
  );
}
