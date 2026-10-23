import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
}

/** Pill toggle for presets and small choices; a row of them acts as a segmented control (Figma: Chip). */
export function Chip({ pressed, className, type = 'button', ...rest }: ChipProps) {
  return <button type={type} className={cx('chip', className)} aria-pressed={pressed} {...rest} />;
}

/** Lays chips out in a wrapping row. */
export function Chips({ children }: { children: ReactNode }) {
  return <div className="chips">{children}</div>;
}
