import type { ReactNode } from 'react';
import { cx } from './cx';

interface CheckboxProps {
  label: ReactNode;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
  title?: string;
  className?: string;
}

/** Checkbox with its label; the whole row is the hit area (Figma: Checkbox). */
export function Checkbox({ label, checked, onChange, disabled, title, className }: CheckboxProps) {
  return (
    <label className={cx('checkbox', disabled && 'is-disabled', className)} title={title}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
