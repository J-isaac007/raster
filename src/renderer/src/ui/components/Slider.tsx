import type { CSSProperties } from 'react';
import { cx } from './cx';

interface SliderProps {
  /** Shown before the track; when omitted, give `ariaLabel`. */
  label?: string;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(value: number): void;
  /** Called when a drag or key press ends (e.g. to seal an undo step). */
  onCommit?(): void;
  /** The value as shown after the track, e.g. "75%". */
  display: string;
  title?: string;
  disabled?: boolean;
  className?: string;
}

/** Labeled range slider with its value in mono (Figma: Slider). */
export function Slider({
  label,
  ariaLabel,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  display,
  title,
  disabled,
  className,
}: SliderProps) {
  // The filled part of the track, which Chromium can't style natively.
  const fill = { '--fill': `${((value - min) / (max - min || 1)) * 100}%` } as CSSProperties;
  return (
    <label className={cx('slider', className)} title={title}>
      {label && <span className="slider-label">{label}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        style={fill}
        onChange={(e) => onChange(+e.target.value)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
      <span className="slider-value">{display}</span>
    </label>
  );
}
