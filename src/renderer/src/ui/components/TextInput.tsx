import type { InputHTMLAttributes, Ref, SelectHTMLAttributes } from 'react';
import { cx } from './cx';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Numbers and hex values. */
  mono?: boolean;
  /** 24 px instead of 28, for dense rows such as the timeline. */
  compact?: boolean;
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Single-line text or number field (Figma: Input). */
export function TextInput({ mono, compact, invalid, className, ...rest }: TextInputProps) {
  return (
    <input
      className={cx('input', mono && 'input-mono', compact && 'input-compact', className)}
      aria-invalid={invalid || undefined}
      spellCheck={false}
      {...rest}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  compact?: boolean;
}

/** Native dropdown styled like the other controls (Figma: Select). */
export function Select({ compact, className, ...rest }: SelectProps) {
  return (
    <select className={cx('input', 'select', compact && 'input-compact', className)} {...rest} />
  );
}
