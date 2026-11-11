import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { alpha, fromHsv, toHsv, type Color } from '@core/color';
import { cx } from './cx';

interface ColorWheelProps {
  color: Color;
  /** Called on every move of a drag or key press. */
  onChange(color: Color): void;
  /** Called once a drag or key press ends, with the color it ended on. */
  onCommit?(color: Color): void;
  className?: string;
}

type Hsv = [number, number, number];

/** Canvas pixels per drawn area; CSS stretches them to fit. Gradients stay smooth. */
const SV_SIZE = 64;
const HUE_WIDTH = 180;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * `color` as HSV, keeping the hue (and saturation) from `prev` where the color
 * alone loses them: grays have no hue, and black has no saturation either.
 */
function hsvOf(color: Color, prev: Hsv | null): Hsv {
  const [h, s, v] = toHsv(color);
  if (!prev) return [h, s, v];
  return [s === 0 || v === 0 ? prev[0] : h, v === 0 ? prev[1] : s, v];
}

/**
 * HSV color picker (Figma: ColorWheel): a saturation/value square over a hue
 * bar. Both parts are sliders for the keyboard: arrows nudge by 1% (or 1°),
 * Shift by 10. The color's alpha is kept.
 */
export function ColorWheel({ color, onChange, onCommit, className }: ColorWheelProps) {
  const [hsv, setHsv] = useState<Hsv>(() => hsvOf(color, null));
  // Follow colors set from outside (hex field, swap, palette). A color this
  // picker just sent already matches `hsv`, so dragging never jumps.
  const [shown, setShown] = useState(color);
  if (color !== shown) {
    setShown(color);
    if (fromHsv(...hsv, alpha(color)) !== color) setHsv(hsvOf(color, hsv));
  }
  const [h, s, v] = hsv;

  const svCanvas = useRef<HTMLCanvasElement>(null);
  const hueCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = svCanvas.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(SV_SIZE, SV_SIZE);
    const px = new Uint32Array(img.data.buffer);
    for (let y = 0; y < SV_SIZE; y++) {
      for (let x = 0; x < SV_SIZE; x++) {
        px[y * SV_SIZE + x] = fromHsv(h, x / (SV_SIZE - 1), 1 - y / (SV_SIZE - 1));
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [h]);

  useEffect(() => {
    const ctx = hueCanvas.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(HUE_WIDTH, 1);
    const px = new Uint32Array(img.data.buffer);
    for (let x = 0; x < HUE_WIDTH; x++) px[x] = fromHsv(x / HUE_WIDTH, 1, 1);
    ctx.putImageData(img, 0, 0);
  }, []);

  const emit = (next: Hsv) => {
    const c = fromHsv(...next, alpha(color));
    setHsv(next);
    if (c !== color) onChange(c);
  };
  const commit = (next: Hsv) => onCommit?.(fromHsv(...next, alpha(color)));

  // ---- pointer and keyboard ---------------------------------------------------
  // Both parts share these handlers; `data-part` says which one an event is for.

  type Part = 'sv' | 'hue';
  const partOf = (e: { currentTarget: HTMLElement }) => e.currentTarget.dataset.part as Part;

  /** The color under the pointer in the part being dragged. */
  const valueAt = (part: Part, e: PointerEvent<HTMLElement>): Hsv => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = clamp01((e.clientX - r.left) / (r.width || 1));
    const y = clamp01((e.clientY - r.top) / (r.height || 1));
    // The hue stops just short of 1, which would wrap back to red at the left end.
    return part === 'sv' ? [h, x, 1 - y] : [Math.min(x, 0.9999), s, v];
  };

  /** The color after pressing `key` on a part; null for keys it doesn't use. */
  const keyStep = (part: Part, key: string, by: number): Hsv | null => {
    if (part === 'sv') {
      if (key === 'ArrowLeft') return [h, clamp01(s - by), v];
      if (key === 'ArrowRight') return [h, clamp01(s + by), v];
      if (key === 'ArrowUp') return [h, s, clamp01(v + by)];
      if (key === 'ArrowDown') return [h, s, clamp01(v - by)];
      return null;
    }
    const turn = by * (100 / 360); // 1° or 10°
    if (key === 'ArrowLeft' || key === 'ArrowDown') return [(h - turn + 1) % 1, s, v];
    if (key === 'ArrowRight' || key === 'ArrowUp') return [(h + turn) % 1, s, v];
    if (key === 'Home') return [0, s, v];
    if (key === 'End') return [359 / 360, s, v];
    return null;
  };

  const dragging = useRef<Hsv | null>(null);
  const nudged = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    dragging.current = valueAt(partOf(e), e);
    emit(dragging.current);
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!dragging.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    dragging.current = valueAt(partOf(e), e);
    emit(dragging.current);
  };
  const onPointerUp = () => {
    if (dragging.current) commit(dragging.current);
    dragging.current = null;
  };
  const onLostPointerCapture = () => {
    dragging.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const next = keyStep(partOf(e), e.key, e.shiftKey ? 0.1 : 0.01);
    if (!next) return;
    e.preventDefault();
    nudged.current = true;
    emit(next);
  };
  const onKeyUp = () => {
    if (nudged.current) commit(hsv);
    nudged.current = false;
  };
  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onLostPointerCapture,
    onKeyDown,
    onKeyUp,
  };

  const hueDeg = Math.round(h * 360) % 360;
  return (
    <div className={cx('color-wheel', className)}>
      <div
        className="color-wheel-sv"
        role="slider"
        tabIndex={0}
        aria-label="Saturation and value"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s * 100)}
        aria-valuetext={`Saturation ${pct(s)}, value ${pct(v)}`}
        title="Saturation (left to right) and value (top to bottom)"
        data-part="sv"
        {...handlers}
      >
        <canvas ref={svCanvas} width={SV_SIZE} height={SV_SIZE} aria-hidden />
        <span className="color-wheel-handle" style={{ left: pct(s), top: pct(1 - v) }} />
      </div>
      <div
        className="color-wheel-hue"
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={hueDeg}
        aria-valuetext={`${hueDeg}°`}
        title="Hue"
        data-part="hue"
        {...handlers}
      >
        <canvas ref={hueCanvas} width={HUE_WIDTH} height={1} aria-hidden />
        <span className="color-wheel-handle" style={{ left: pct(h) }} />
      </div>
    </div>
  );
}
