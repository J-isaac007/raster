import { describe, expect, it } from 'vitest';
import { rgba, TRANSPARENT } from '@core/color';
import { MAX_RECENT_COLORS } from '@core/format';
import { makeRamp } from '@core/ramp';
import { createSprite } from '@core/sprite';
import { at, RED, setup } from './testing';
import { TOOL_BY_ID } from './tools';

const BLUE = rgba(0, 0, 255);
const GREEN = rgba(0, 255, 0);
const gray = (n: number) => rgba(n, n, n);

describe('Recent colors', () => {
  it('keeps the newest first, without repeats', () => {
    const { ed } = setup();
    ed.rememberColor(RED);
    ed.rememberColor(BLUE);
    ed.rememberColor(GREEN);
    ed.rememberColor(RED);
    expect(ed.getState().recentColors).toEqual([RED, GREEN, BLUE]);
  });

  it(`keeps at most ${MAX_RECENT_COLORS}`, () => {
    const { ed } = setup();
    for (let i = 1; i <= 20; i++) ed.rememberColor(gray(i));
    const recent = ed.getState().recentColors;
    expect(recent).toHaveLength(MAX_RECENT_COLORS);
    expect(recent[0]).toBe(gray(20));
    expect(recent.at(-1)).toBe(gray(5));
  });

  it('skips transparent and leaves the document clean and undo alone', () => {
    const { ed } = setup();
    ed.rememberColor(TRANSPARENT);
    ed.rememberColor(BLUE);
    const s = ed.getState();
    expect(s.recentColors).toEqual([BLUE]);
    expect(s.dirty).toBe(false);
    expect(s.undoLabel).toBeUndefined();
  });

  it('remembers a picked color', () => {
    const { ed, drag } = setup(2, 1);
    drag('pencil', [0, 0], [0, 0]);
    ed.pickColor(0, 0, 'secondary');
    expect(ed.getState().secondary).toBe(RED);
    expect(ed.getState().recentColors).toEqual([RED]);
  });

  it('remembers only the color a picker drag ends on', () => {
    const { ed, drag } = setup(3, 1);
    drag('pencil', [0, 0], [0, 0]);
    ed.setPrimary(BLUE);
    drag('pencil', [1, 0], [1, 0]);
    ed.setPrimary(GREEN);
    drag('pencil', [2, 0], [2, 0]);

    const picker = TOOL_BY_ID.picker;
    picker.down(ed, at(0, 0));
    picker.move(ed, at(1, 0));
    expect(ed.getState().recentColors).toEqual([]);
    picker.move(ed, at(2, 0));
    picker.up(ed, at(2, 0));
    expect(ed.getState().primary).toBe(GREEN);
    expect(ed.getState().recentColors).toEqual([GREEN]);
  });

  it('is saved with the project and reset by a new document', () => {
    const { ed } = setup();
    ed.rememberColor(BLUE);
    ed.rememberColor(GREEN);
    expect(ed.project.recentColors).toEqual([GREEN, BLUE]);

    ed.load(createSprite(4, 4), { recentColors: [RED] });
    expect(ed.getState().recentColors).toEqual([RED]);
    ed.newSprite(8, 8);
    expect(ed.getState().recentColors).toEqual([]);
  });
});

describe('Ramps', () => {
  const ORANGE = rgba(204, 107, 51);

  it('puts the ramp around its base color in the palette, as one undo step', () => {
    const { ed } = setup();
    ed.setPalette([BLUE, ORANGE, GREEN]);
    const ramp = makeRamp(ORANGE, { steps: 5 });
    ed.addRamp(ORANGE, ramp);

    expect(ed.getState().palette).toEqual([BLUE, ...ramp, GREEN]);
    expect(ed.getState().undoLabel).toBe('Add Ramp');
    expect(ed.getState().dirty).toBe(true);
    ed.undo();
    expect(ed.getState().palette).toEqual([BLUE, ORANGE, GREEN]);
    ed.redo();
    expect(ed.getState().palette).toEqual([BLUE, ...ramp, GREEN]);
  });

  it('adds the ramp at the end when the base is not in the palette', () => {
    const { ed } = setup();
    ed.setPalette([BLUE, GREEN]);
    const ramp = makeRamp(ORANGE, { steps: 4 });
    ed.addRamp(ORANGE, ramp);
    expect(ed.getState().palette).toEqual([BLUE, GREEN, ...ramp]);
  });

  it('stops at the palette size limit', () => {
    const { ed } = setup();
    const full = Array.from({ length: 256 }, (_, i) => rgba(i, 0, 0));
    ed.setPalette(full);
    ed.addRamp(ORANGE, makeRamp(ORANGE));
    expect(ed.getState().palette).toBe(full);
    expect(ed.getState().undoLabel).toBe('Change Palette');
  });

  it('lets the Shade tool walk along the new ramp', () => {
    const { ed, px, drag } = setup(1, 1);
    const ramp = makeRamp(ORANGE, { steps: 5 });
    ed.setPalette([BLUE, ORANGE]);
    ed.addRamp(ORANGE, ramp);
    ed.setPrimary(ORANGE);
    drag('pencil', [0, 0], [0, 0]);

    drag('shade', [0, 0], [0, 0]);
    expect(px(0, 0)).toBe(ramp[3]);
    drag('shade', [0, 0], [0, 0]);
    expect(px(0, 0)).toBe(ramp[4]);
    TOOL_BY_ID.shade.down(ed, at(0, 0, { button: 2 }));
    TOOL_BY_ID.shade.up(ed, at(0, 0, { button: 2 }));
    expect(px(0, 0)).toBe(ramp[3]);
  });
});
