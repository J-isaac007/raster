import { cx } from './cx';

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange(on: boolean): void;
  /** A second line under the label. */
  description?: string;
  className?: string;
}

/** An on/off setting that applies at once; the label sits left, the switch right (Figma: Switch). */
export function Switch({ label, checked, onChange, description, className }: SwitchProps) {
  return (
    <label className={cx('switch-row', className)}>
      <span className="switch-text">
        <span>{label}</span>
        {description && <span className="switch-description">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
