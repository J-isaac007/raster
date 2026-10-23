import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** What the button does; read by screen readers and shown in its tooltip. */
  label: string;
  /** Shown in the tooltip, e.g. "Shift+N". */
  shortcut?: string;
  /** Tool (32 px) for the toolbar, Small (24 px) for panel headers and inline actions. */
  size?: 'tool' | 'small';
  /** Marks the current tool or a toggled option. */
  pressed?: boolean;
}

/** Square icon button with a tooltip (Figma: IconButton). */
export function IconButton({
  icon: Icon,
  label,
  shortcut,
  size = 'small',
  pressed,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cx('icon-button', `icon-button-${size}`, className)}
      aria-label={label}
      aria-pressed={pressed}
      data-tooltip={label}
      data-shortcut={shortcut}
      {...rest}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
