import { DITHER_LEVELS, ditherHit } from './brush';

/** Linear runs along the drag; radial spreads out from its start. */
export type GradientKind = 'linear' | 'radial';

/**
 * Where (x, y) sits on a gradient dragged from (x0, y0) to (x1, y1), 0..1.
 * Linear: the projection onto the drag line. Radial: the distance from the
 * start over the drag length. A zero-length drag gives 0 everywhere.
 */
export function gradientT(
  kind: GradientKind,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number,
  y: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  const t =
    kind === 'linear'
      ? ((x - x0) * dx + (y - y0) * dy) / len2
      : Math.sqrt(((x - x0) ** 2 + (y - y0) ** 2) / len2);
  return Math.min(1, Math.max(0, t));
}

/** The ordered-dither level (0..DITHER_LEVELS) for a gradient position. */
export const gradientLevel = (t: number): number => Math.round(t * DITHER_LEVELS);

/**
 * Whether pixel (x, y) at gradient position `t` takes the end color rather
 * than the start color. The 4×4 ordered dither gives DITHER_LEVELS + 1 steps.
 */
export const gradientHit = (x: number, y: number, t: number): boolean =>
  ditherHit(x, y, gradientLevel(t));
