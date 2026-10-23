import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Primary for a dialog's main action, Ghost in toolbars, Danger for destructive actions. */
  variant?: ButtonVariant;
}

/** Text button, 28 px tall (Figma: Button). */
export function Button({
  variant = 'secondary',
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return <button type={type} className={cx('btn', `btn-${variant}`, className)} {...rest} />;
}
