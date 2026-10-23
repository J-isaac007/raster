// Helpers shared by the editor's tests.
import { rgba } from '@core/color';
import { createSprite } from '@core/sprite';
import { Editor } from './editor';
import { TOOL_BY_ID, type ToolEvent } from './tools';

export const RED = rgba(255, 0, 0);
export const at = (x: number, y: number, extra: Partial<ToolEvent> = {}): ToolEvent => ({
  x,
  y,
  button: 0,
  shift: false,
  ...extra,
});

/** An editor on a blank sprite, with red as the primary color. */
export function setup(w = 8, h = 8) {
  const ed = new Editor(createSprite(w, h));
  ed.setPrimary(RED);
  const px = (x: number, y: number) => ed.activeLayer.pixels[y * ed.sprite.width + x];
  const drag = (
    tool: keyof typeof TOOL_BY_ID,
    from: [number, number],
    to: [number, number],
    shift = false,
  ) => {
    const t = TOOL_BY_ID[tool];
    t.down(ed, at(...from, { shift }));
    t.move(ed, at(...to, { shift }));
    t.up(ed, at(...to, { shift }));
  };
  return { ed, px, drag };
}
