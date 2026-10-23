import { MAX_SPRITE_SIZE } from '@core/sprite';
import { TextInput } from '../components';

/** Width and height rows for the size dialogs; goes inside a `.form-grid`. */
export function SizeFields({
  width,
  height,
  setWidth,
  setHeight,
}: {
  width: number;
  height: number;
  setWidth: (n: number) => void;
  setHeight: (n: number) => void;
}) {
  return (
    <>
      <label htmlFor="size-w">Width</label>
      <div className="field-row">
        <TextInput
          id="size-w"
          className="input-short"
          type="number"
          min={1}
          max={MAX_SPRITE_SIZE}
          value={width}
          onChange={(e) => setWidth(+e.target.value)}
        />
        <span className="hint">px</span>
      </div>
      <label htmlFor="size-h">Height</label>
      <div className="field-row">
        <TextInput
          id="size-h"
          className="input-short"
          type="number"
          min={1}
          max={MAX_SPRITE_SIZE}
          value={height}
          onChange={(e) => setHeight(+e.target.value)}
        />
        <span className="hint">px</span>
      </div>
    </>
  );
}
