/**
 * Per-cel properties. A cel is a pixel buffer; frames that share a buffer are
 * linked cels and share everything about it. So the properties are keyed by the
 * buffer itself: linked cels agree automatically, and moving, inserting or
 * deleting frames carries them along with no bookkeeping.
 *
 * Code that makes a new buffer from an old one (geometry changes, cloning,
 * merging, unlinking) copies the properties with `copyCelProps`; `mapCels` in
 * sprite.ts does this for every buffer it creates.
 */

const opacities = new WeakMap<Uint32Array, number>();

/** A cel's opacity, 0..1 (1 unless set). */
export const celOpacity = (cel: Uint32Array): number => opacities.get(cel) ?? 1;

export function setCelOpacity(cel: Uint32Array, opacity: number): void {
  const v = Math.min(1, Math.max(0, Number.isFinite(opacity) ? opacity : 1));
  if (v === 1) opacities.delete(cel);
  else opacities.set(cel, v);
}

/** Gives `to` the same per-cel properties as `from`. */
export function copyCelProps(from: Uint32Array, to: Uint32Array): void {
  if (from !== to) setCelOpacity(to, celOpacity(from));
}
