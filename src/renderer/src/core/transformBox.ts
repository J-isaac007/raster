/**
 * Geometry of the on-canvas transform box: where its handles are, what the
 * pointer is over, and how dragging a handle scales or turns it. Coordinates
 * are sprite pixels (fractions allowed) with y pointing down, so positive
 * angles turn clockwise, as in `rotSprite`.
 */

/** The box around the transformed pixels. */
export interface TransformBox {
  /** Center. */
  cx: number;
  cy: number;
  /** Size before rotation. */
  width: number;
  height: number;
  /** Clockwise, in degrees. */
  angle: number;
}

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Which way each handle points from the center, in the box's own (unrotated) frame. */
export const HANDLE_DIRECTIONS: Record<HandleId, readonly [number, number]> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};

export const HANDLES = Object.keys(HANDLE_DIRECTIONS) as HandleId[];

export type TransformHit =
  { kind: 'scale'; handle: HandleId } | { kind: 'rotate' } | { kind: 'move' };

/** Hit-test distances, in sprite pixels (the canvas divides screen pixels by the zoom). */
export interface HitSizes {
  /** How close to a handle counts as on it. */
  handle: number;
  /** How far outside a corner still rotates. */
  rotate: number;
  /** How far the rotation knob sits above the top edge. */
  knob: number;
}

const RAD = Math.PI / 180;

/** Turns (x, y) clockwise by `degrees` around the origin. */
function turn(x: number, y: number, degrees: number): [number, number] {
  const c = Math.cos(degrees * RAD);
  const s = Math.sin(degrees * RAD);
  return [x * c - y * s, x * s + y * c];
}

/** A point given in the box's own frame (relative to its center, unrotated), in sprite coordinates. */
export function fromBox(box: TransformBox, u: number, v: number): [number, number] {
  const [x, y] = turn(u, v, box.angle);
  return [box.cx + x, box.cy + y];
}

/** A sprite point in the box's own frame. */
export function toBox(box: TransformBox, x: number, y: number): [number, number] {
  return turn(x - box.cx, y - box.cy, -box.angle);
}

export function handlePoint(box: TransformBox, handle: HandleId): [number, number] {
  const [dx, dy] = HANDLE_DIRECTIONS[handle];
  return fromBox(box, (dx * box.width) / 2, (dy * box.height) / 2);
}

/** The rotation knob, `distance` above the middle of the top edge. */
export function knobPoint(box: TransformBox, distance: number): [number, number] {
  return fromBox(box, 0, -box.height / 2 - distance);
}

/** The four corners, clockwise from the top left. */
export function boxCorners(box: TransformBox): [number, number][] {
  return (['nw', 'ne', 'se', 'sw'] as const).map((h) => handlePoint(box, h));
}

/**
 * What a press at (x, y) would grab: the knob or a point just outside a
 * corner rotates, a handle scales, the inside moves. Null elsewhere.
 */
export function hitTest(
  box: TransformBox,
  x: number,
  y: number,
  sizes: HitSizes,
): TransformHit | null {
  const near = ([px, py]: [number, number], r: number) => Math.hypot(x - px, y - py) <= r;
  if (near(knobPoint(box, sizes.knob), sizes.handle)) return { kind: 'rotate' };
  // Corners first: they win over edge handles on a tiny box.
  for (const handle of ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'] as const) {
    if (near(handlePoint(box, handle), sizes.handle)) return { kind: 'scale', handle };
  }
  const [u, v] = toBox(box, x, y);
  const hw = box.width / 2;
  const hh = box.height / 2;
  if (Math.abs(u) <= hw && Math.abs(v) <= hh) return { kind: 'move' };
  // Outside, within reach of the nearest corner.
  const cu = u < 0 ? -hw : hw;
  const cv = v < 0 ? -hh : hh;
  return Math.hypot(u - cu, v - cv) <= sizes.rotate ? { kind: 'rotate' } : null;
}

export interface ScaleOptions {
  /** Keep the width-to-height ratio. */
  keep: boolean;
  /** Scale around the center instead of the opposite handle. */
  fromCenter: boolean;
  /** Smallest width and height, in sprite pixels. */
  minSize?: number;
}

/**
 * The box after dragging `handle` from where it was in `start` to (x, y).
 * Corners scale both sides, edges one. The opposite handle stays put, or the
 * center with `fromCenter`. With `keep`, both sides scale by the same factor:
 * a corner follows the pointer along its diagonal. The box never flips.
 */
export function scaleBox(
  start: TransformBox,
  handle: HandleId,
  x: number,
  y: number,
  { keep, fromCenter, minSize = 1 }: ScaleOptions,
): TransformBox {
  const [dx, dy] = HANDLE_DIRECTIONS[handle];
  const [u, v] = toBox(start, x, y);
  // The fixed point, and the pointer measured from it.
  const au = fromCenter ? 0 : (-dx * start.width) / 2;
  const av = fromCenter ? 0 : (-dy * start.height) / 2;
  const reach = fromCenter ? 2 : 1;
  let width = dx ? dx * (u - au) * reach : start.width;
  let height = dy ? dy * (v - av) * reach : start.height;

  if (keep) {
    let f: number;
    if (dx && dy) {
      // Project the pointer onto the diagonal from the fixed point to the handle.
      const du = (dx * start.width) / reach;
      const dv = (dy * start.height) / reach;
      f = ((u - au) * du + (v - av) * dv) / (du * du + dv * dv);
    } else {
      f = dx ? width / start.width : height / start.height;
    }
    f = Math.max(f, minSize / start.width, minSize / start.height);
    width = start.width * f;
    height = start.height * f;
  } else {
    width = Math.max(minSize, width);
    height = Math.max(minSize, height);
  }

  // The new center, in the start box's frame: halfway out from the fixed point.
  const cu = fromCenter || !dx ? 0 : au + (dx * width) / 2;
  const cv = fromCenter || !dy ? 0 : av + (dy * height) / 2;
  const [cx, cy] = fromBox(start, cu, cv);
  return { ...start, cx, cy, width, height };
}

/** `degrees` folded into (-180, 180]. */
export function normalizeAngle(degrees: number): number {
  const a = ((degrees % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}

/** Rounds to the nearest multiple of `step` degrees. */
export function snapDegrees(degrees: number, step = 15): number {
  return normalizeAngle(Math.round(degrees / step) * step);
}

/**
 * The box's angle after dragging around its center from (x0, y0) to (x, y),
 * in whole degrees, or snapped to 15° steps.
 */
export function dragAngle(
  start: TransformBox,
  x0: number,
  y0: number,
  x: number,
  y: number,
  snap: boolean,
): number {
  const from = Math.atan2(y0 - start.cy, x0 - start.cx);
  const to = Math.atan2(y - start.cy, x - start.cx);
  const angle = start.angle + (to - from) / RAD;
  return snap ? snapDegrees(angle) : normalizeAngle(Math.round(angle));
}

/** The CSS resize cursor for a handle, following the box's rotation. */
export function resizeCursor(box: TransformBox, handle: HandleId): string {
  const [dx, dy] = HANDLE_DIRECTIONS[handle];
  const [x, y] = turn(dx, dy, box.angle);
  const a = (((Math.atan2(y, x) / RAD) % 180) + 180) % 180;
  if (a < 22.5 || a >= 157.5) return 'ew-resize';
  if (a < 67.5) return 'nwse-resize';
  if (a < 112.5) return 'ns-resize';
  return 'nesw-resize';
}
