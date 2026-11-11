import { useState } from 'react';
import { Slider } from '../components';
import { AdjustDialog } from './AdjustDialog';

/** `+12`, `-5` or `0`, with an optional unit. */
const signed = (n: number, unit = '') => `${n > 0 ? '+' : ''}${n}${unit}`;

/** Adjust › Hue/Saturation (Figma: Dialog / Hue/Saturation). */
export function HueSaturationDialog({ onClose }: { onClose: () => void }) {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [lightness, setLightness] = useState(0);

  return (
    <AdjustDialog
      adjustment={{ kind: 'hueSaturation', hue, saturation, lightness }}
      onClose={onClose}
    >
      <span className="form-label">Hue</span>
      <Slider
        ariaLabel="Hue"
        min={-180}
        max={180}
        value={hue}
        onChange={setHue}
        display={signed(hue, '°')}
      />
      <span className="form-label">Saturation</span>
      <Slider
        ariaLabel="Saturation"
        min={-100}
        max={100}
        value={saturation}
        onChange={setSaturation}
        display={signed(saturation)}
      />
      <span className="form-label">Lightness</span>
      <Slider
        ariaLabel="Lightness"
        min={-100}
        max={100}
        value={lightness}
        onChange={setLightness}
        display={signed(lightness)}
      />
    </AdjustDialog>
  );
}
