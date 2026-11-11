import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { updateSettings } from '@platform/settings';
import { MAX_ONION_FRAMES } from '@shared/settings';
import { IconButton, Slider, Switch } from '../components';
import { useSettings } from '../useSettings';

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange(value: number): void;
}) {
  return (
    <div className="onion-row">
      <span className="form-label">{label}</span>
      <span className="stepper" role="group" aria-label={label}>
        <IconButton
          icon={Minus}
          label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
        />
        <span className="stepper-value mono" aria-live="polite">
          {value}
        </span>
        <IconButton
          icon={Plus}
          label={`More ${label.toLowerCase()}`}
          disabled={value >= MAX_ONION_FRAMES}
          onClick={() => onChange(value + 1)}
        />
      </span>
    </div>
  );
}

/**
 * Onion skin options (Figma: Popover / Onion skin): how many frames to show
 * each way, their opacity, and tint colors. Saved in Preferences.
 */
export function OnionOptions({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-onion-toggle]')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  return (
    <div className="popover onion-popover" role="dialog" aria-label="Onion skin options" ref={ref}>
      <h3 className="popover-title">Onion skin</h3>
      <Stepper
        label="Frames before"
        value={s.onionBefore}
        onChange={(onionBefore) => updateSettings({ onionBefore })}
      />
      <Stepper
        label="Frames after"
        value={s.onionAfter}
        onChange={(onionAfter) => updateSettings({ onionAfter })}
      />
      <Slider
        label="Opacity"
        min={10}
        max={90}
        value={Math.round(s.onionOpacity * 100)}
        display={`${Math.round(s.onionOpacity * 100)}%`}
        onChange={(v) => updateSettings({ onionOpacity: v / 100 })}
      />
      <Switch
        label="Tint"
        checked={s.onionTint}
        onChange={(onionTint) => updateSettings({ onionTint })}
      />
      <div className="onion-colors">
        <label className="onion-color">
          <span className="form-label">Before</span>
          <input
            type="color"
            aria-label="Tint for frames before"
            disabled={!s.onionTint}
            value={s.onionBeforeColor}
            onChange={(e) => updateSettings({ onionBeforeColor: e.target.value })}
          />
        </label>
        <label className="onion-color">
          <span className="form-label">After</span>
          <input
            type="color"
            aria-label="Tint for frames after"
            disabled={!s.onionTint}
            value={s.onionAfterColor}
            onChange={(e) => updateSettings({ onionAfterColor: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
