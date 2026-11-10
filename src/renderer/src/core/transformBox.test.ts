import { describe, expect, it } from 'vitest';
import {
  dragAngle,
  handlePoint,
  hitTest,
  knobPoint,
  normalizeAngle,
  resizeCursor,
  scaleBox,
  snapDegrees,
  type TransformBox,
} from './transformBox';

/** A 4×2 box centered on (10, 10): corners at (8, 9) and (12, 11). */
const box: TransformBox = { cx: 10, cy: 10, width: 4, height: 2, angle: 0 };
const free = { keep: false, fromCenter: false };
const near = (a: number[], b: number[]) => a.forEach((n, i) => expect(n).toBeCloseTo(b[i], 6));
const shape = (b: TransformBox) => [b.cx, b.cy, b.width, b.height];

describe('scaleBox', () => {
  it('scales both sides from a corner, keeping the opposite corner still', () => {
    const b = scaleBox(box, 'se', 14, 12, free);
    near(shape(b), [11, 10.5, 6, 3]);
    near(handlePoint(b, 'nw'), [8, 9]);
  });

  it('scales one side from an edge', () => {
    near(shape(scaleBox(box, 'e', 16, 30, free)), [12, 10, 8, 2]);
    near(shape(scaleBox(box, 'n', 0, 7, free)), [10, 9, 4, 4]);
    near(handlePoint(scaleBox(box, 'n', 0, 7, free), 's'), [10, 11]);
  });

  it('scales around the center with fromCenter', () => {
    near(shape(scaleBox(box, 'se', 14, 12, { keep: false, fromCenter: true })), [10, 10, 8, 4]);
    near(shape(scaleBox(box, 'w', 7, 10, { keep: false, fromCenter: true })), [10, 10, 6, 2]);
  });

  it('keeps proportions along the corner diagonal', () => {
    // The pointer is past the corner on x only; the box grows evenly.
    const b = scaleBox(box, 'se', 16, 11, { keep: true, fromCenter: false });
    expect(b.width / b.height).toBeCloseTo(2, 6);
    near(handlePoint(b, 'nw'), [8, 9]);
    // Exactly on the diagonal doubles both sides.
    near(shape(scaleBox(box, 'se', 16, 13, { keep: true, fromCenter: false })), [12, 11, 8, 4]);
  });

  it('keeps proportions from an edge, centered on the other axis', () => {
    near(shape(scaleBox(box, 'e', 16, 10, { keep: true, fromCenter: false })), [12, 10, 8, 4]);
  });

  it('never flips or shrinks below the minimum size', () => {
    near(shape(scaleBox(box, 'se', 0, 0, free)), [8.5, 9.5, 1, 1]);
    const kept = scaleBox(box, 'se', 0, 0, { keep: true, fromCenter: false });
    near([kept.width, kept.height], [2, 1]);
  });

  it('works in the frame of a turned box', () => {
    const turned = { ...box, angle: 90 };
    // Turned a quarter clockwise, the box's right edge faces down.
    near(handlePoint(turned, 'e'), [10, 12]);
    const b = scaleBox(turned, 'e', 10, 16, free);
    near(shape(b), [10, 12, 8, 2]);
    near(handlePoint(b, 'w'), [10, 8]);
  });
});

describe('dragAngle', () => {
  it('measures the turn around the center, clockwise positive', () => {
    // From straight right of the center to straight below: a quarter turn clockwise.
    expect(dragAngle(box, 20, 10, 10, 20, false)).toBe(90);
    expect(dragAngle(box, 20, 10, 10, 0, false)).toBe(-90);
  });

  it('adds to the starting angle and rounds to whole degrees', () => {
    const start = { ...box, angle: 30 };
    const a = 10.4 * (Math.PI / 180);
    expect(dragAngle(start, 20, 10, 10 + 10 * Math.cos(a), 10 + 10 * Math.sin(a), false)).toBe(40);
  });

  it('snaps to 15° steps', () => {
    const a = 37 * (Math.PI / 180);
    expect(dragAngle(box, 20, 10, 10 + 10 * Math.cos(a), 10 + 10 * Math.sin(a), true)).toBe(30);
    expect(snapDegrees(52)).toBe(45);
    expect(snapDegrees(53)).toBe(60);
    expect(snapDegrees(-7)).toBe(0);
    expect(snapDegrees(-8)).toBe(-15);
  });

  it('folds angles into (-180, 180]', () => {
    expect(normalizeAngle(190)).toBe(-170);
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(360)).toBe(0);
  });
});

describe('hitTest', () => {
  const sizes = { handle: 0.5, rotate: 2, knob: 3 };

  it('finds handles, the inside, and the rotate zone outside corners', () => {
    expect(hitTest(box, 12.2, 11.1, sizes)).toEqual({ kind: 'scale', handle: 'se' });
    expect(hitTest(box, 10, 9, sizes)).toEqual({ kind: 'scale', handle: 'n' });
    expect(hitTest(box, 9, 10.5, sizes)).toEqual({ kind: 'move' });
    expect(hitTest(box, 13, 12, sizes)).toEqual({ kind: 'rotate' });
    // Outside, far from any corner.
    expect(hitTest(box, 10, 14, sizes)).toBeNull();
    expect(hitTest(box, 20, 20, sizes)).toBeNull();
  });

  it('finds the rotation knob above the top edge, following the angle', () => {
    near(knobPoint(box, 3), [10, 6]);
    expect(hitTest(box, 10, 6, sizes)).toEqual({ kind: 'rotate' });
    const turned = { ...box, angle: 90 };
    near(knobPoint(turned, 3), [14, 10]);
    expect(hitTest(turned, 14, 10, sizes)).toEqual({ kind: 'rotate' });
  });
});

describe('resizeCursor', () => {
  it('follows the box rotation', () => {
    expect(resizeCursor(box, 'e')).toBe('ew-resize');
    expect(resizeCursor(box, 'n')).toBe('ns-resize');
    expect(resizeCursor(box, 'se')).toBe('nwse-resize');
    expect(resizeCursor(box, 'ne')).toBe('nesw-resize');
    expect(resizeCursor({ ...box, angle: 90 }, 'e')).toBe('ns-resize');
    expect(resizeCursor({ ...box, angle: 45 }, 'e')).toBe('nwse-resize');
  });
});
