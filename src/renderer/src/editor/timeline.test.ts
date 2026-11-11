import { describe, expect, it } from 'vitest';
import { celOpacity, setCelOpacity } from '@core/cels';
import { setup } from './testing';

/** Five frames timed 100..500 ms on two layers (Top above Bottom). */
function five() {
  const t = setup(2, 2);
  for (let i = 1; i < 5; i++) t.ed.addFrame();
  [100, 200, 300, 400, 500].forEach((ms, i) => t.ed.setFrameDuration(i, ms));
  t.ed.addLayer();
  t.ed.sealHistory();
  const [bottom, top] = t.ed.sprite.layers;
  const order = () => t.ed.getState().frames;
  return { ...t, bottom, top, order };
}

describe('moving and copying frames', () => {
  it('moves a block of frames later and earlier, selecting it', () => {
    const { ed, order } = five();
    ed.setFrame(1);
    ed.moveFrames(0, 1, 4); // frames 1-2 into the gap before frame 5
    expect(order()).toEqual([300, 400, 100, 200, 500]);
    expect(ed.getState().frame).toBe(3); // the frame that was current
    expect(ed.getState().timelineSelection).toEqual({ layerIds: [], frames: [2, 3] });
    ed.moveFrames(2, 3, 0);
    expect(order()).toEqual([100, 200, 300, 400, 500]);
  });

  it('ignores a move into the block itself', () => {
    const { ed, order } = five();
    const undo = ed.getState().undoLabel;
    ed.moveFrames(1, 2, 2);
    ed.moveFrames(1, 2, 3);
    expect(order()).toEqual([100, 200, 300, 400, 500]);
    expect(ed.getState().undoLabel).toBe(undo);
  });

  it('copies a block with its own cels, keeping links inside it', () => {
    const { ed, order, bottom } = five();
    ed.setFrame(0);
    ed.duplicateLinkedFrame(); // frames 0 and 1 share a cel
    ed.moveFrames(0, 1, 6, true);
    expect(order()).toEqual([100, 100, 200, 300, 400, 500, 100, 100]);
    const cels = bottom.cels;
    expect(cels[6]).not.toBe(cels[0]);
    expect(cels[6]).toBe(cels[7]);
    ed.undo();
    expect(order()).toEqual([100, 100, 200, 300, 400, 500]);
  });

  it('shifts tags when copying, keeps them when moving', () => {
    const { ed } = five();
    ed.addTag({ name: 'walk', from: 2, to: 3 });
    ed.moveFrames(0, 0, 4);
    expect(ed.getState().tags[0]).toMatchObject({ from: 2, to: 3 });
    ed.moveFrames(0, 0, 1, true);
    expect(ed.getState().tags[0]).toMatchObject({ from: 3, to: 4 });
  });

  it('deletes a range of frames as one step', () => {
    const { ed, order } = five();
    ed.deleteFrames(1, 3);
    expect(order()).toEqual([100, 500]);
    ed.deleteFrames(0, 1);
    expect(order()).toEqual([100, 500]);
    expect(ed.getState().message).toBe('A sprite needs at least one frame');
    ed.undo();
    expect(order()).toEqual([100, 200, 300, 400, 500]);
  });
});

describe('moving and copying cels', () => {
  it('moves cels along a layer, keeping the buffer, and leaves empty cels', () => {
    const { ed, top } = five();
    const cel = top.cels[0];
    setCelOpacity(cel, 0.5);
    ed.moveCels([top.id], [top.id], 0, 0, 2);
    expect(top.cels[2]).toBe(cel);
    expect(top.cels[0]).not.toBe(cel);
    expect(celOpacity(top.cels[0])).toBe(1);
    expect(ed.getState().timelineSelection).toEqual({ layerIds: [top.id], frames: [2, 2] });
    ed.undo();
    expect(top.cels[0]).toBe(cel);
  });

  it('moves cels to another layer as their own copy, with opacity', () => {
    const { ed, top, bottom } = five();
    top.cels[1][0] = 0xff0000ff;
    setCelOpacity(top.cels[1], 0.25);
    ed.moveCels([top.id], [bottom.id], 1, 1, 0);
    expect(bottom.cels[1][0]).toBe(0xff0000ff);
    expect(bottom.cels[1]).not.toBe(top.cels[1]);
    expect(celOpacity(bottom.cels[1])).toBe(0.25);
    expect(top.cels[1][0]).toBe(0);
  });

  it('copies overlapping ranges without reading its own writes', () => {
    const { ed, top } = five();
    top.cels.forEach((c, i) => (c[0] = i + 1));
    ed.moveCels([top.id], [top.id], 0, 2, 1, true);
    expect(top.cels.map((c) => c[0])).toEqual([1, 1, 2, 3, 5]);
  });

  it('refuses moves that would leave the sprite', () => {
    const { ed, top, order } = five();
    const before = [...top.cels];
    ed.moveCels([top.id], [top.id], 3, 4, 1);
    expect(top.cels).toEqual(before);
    expect(order()).toHaveLength(5);
  });
});
