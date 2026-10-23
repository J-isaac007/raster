import { describe, expect, it } from 'vitest';
import { RED, setup } from './testing';

describe('Editor frames', () => {
  it('adds frames with their own pixels and switches between them', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [0, 0], [0, 0]);
    ed.addFrame();
    expect(ed.getState().frame).toBe(1);
    expect(ed.getState().frames).toHaveLength(2);
    expect(px(0, 0)).toBe(0);
    drag('pencil', [1, 1], [1, 1]);
    ed.setFrame(0);
    expect(px(0, 0)).toBe(RED);
    expect(px(1, 1)).toBe(0);
  });

  it('duplicates the current frame', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [2, 2], [2, 2]);
    ed.duplicateFrame();
    expect(px(2, 2)).toBe(RED);
    drag('eraser', [2, 2], [2, 2]);
    ed.setFrame(0);
    expect(px(2, 2)).toBe(RED);
  });

  it('undoes a stroke on the frame it was drawn on', () => {
    const { ed, px, drag } = setup();
    ed.addFrame();
    drag('pencil', [3, 3], [3, 3]);
    ed.setFrame(0);
    ed.undo();
    expect(ed.getState().frame).toBe(1);
    expect(px(3, 3)).toBe(0);
  });

  it('deletes and reorders frames undoably', () => {
    const { ed, px, drag } = setup();
    drag('pencil', [0, 0], [0, 0]);
    ed.addFrame();
    drag('pencil', [7, 7], [7, 7]);
    ed.moveFrame(-1);
    expect(ed.getState().frame).toBe(0);
    expect(px(7, 7)).toBe(RED);
    ed.deleteFrame();
    expect(ed.frameCount).toBe(1);
    expect(px(0, 0)).toBe(RED);
    ed.undo();
    expect(ed.frameCount).toBe(2);
    expect(px(7, 7)).toBe(RED);
    ed.undo();
    ed.setFrame(0);
    expect(px(0, 0)).toBe(RED);
  });

  it('keeps every frame in sync for layer and canvas changes', () => {
    const { ed, drag } = setup(4, 4);
    ed.addFrame();
    ed.addLayer();
    expect(ed.activeLayer.cels).toHaveLength(2);
    drag('pencil', [0, 0], [0, 0]);
    ed.mergeDown();
    expect(ed.sprite.layers[0].cels[1][0]).toBe(RED);
    ed.resizeCanvas(6, 6, 0, 0);
    expect(ed.sprite.layers[0].cels.every((c) => c.length === 36)).toBe(true);
  });

  it('sets durations, merging repeated edits', () => {
    const { ed } = setup();
    ed.setFrameDuration(0, 150);
    ed.setFrameDuration(0, 200);
    expect(ed.getState().frames).toEqual([200]);
    ed.undo();
    expect(ed.getState().frames).toEqual([100]);
  });

  it('only plays with more than one frame', () => {
    const { ed } = setup();
    ed.setPlaying(true);
    expect(ed.getState().playing).toBe(false);
    ed.addFrame();
    ed.setPlaying(true);
    expect(ed.getState().playing).toBe(true);
  });
});

describe('Editor linked cels', () => {
  it('duplicates a frame with linked cels that share edits', () => {
    const { ed, px, drag } = setup(4, 4);
    ed.duplicateLinkedFrame();
    expect(ed.getState().frame).toBe(1);
    expect(ed.celLinked).toBe(true);
    drag('pencil', [1, 1], [1, 1]);
    ed.setFrame(0);
    expect(px(1, 1)).toBe(RED);
    ed.undo();
    expect(ed.getState().frame).toBe(1);
    expect(px(1, 1)).toBe(0);
  });

  it('unlinks a cel as one undo step', () => {
    const { ed, px, drag } = setup(4, 4);
    ed.duplicateLinkedFrame();
    ed.unlinkCel();
    expect(ed.celLinked).toBe(false);
    drag('pencil', [2, 2], [2, 2]);
    ed.setFrame(0);
    expect(px(2, 2)).toBe(0);
    ed.undo(); // pencil
    ed.undo(); // unlink
    expect(ed.getState().undoLabel).toBe('Duplicate Linked Frame');
    expect(ed.celLinked).toBe(true);
  });

  it('keeps links through canvas resize, flips and merges', () => {
    const { ed, drag } = setup(4, 4);
    drag('pencil', [0, 0], [0, 0]);
    ed.duplicateLinkedFrame();
    ed.resizeCanvas(5, 5, 0, 0);
    const cels = () => ed.sprite.layers[0].cels;
    expect(cels()[1]).toBe(cels()[0]);
    ed.flip('horizontal', 'sprite');
    expect(cels()[0][4]).toBe(RED);
    ed.addLayer();
    ed.mergeDown();
    expect(cels()[1]).toBe(cels()[0]);
    expect(cels()[0][4]).toBe(RED);
    ed.undo();
    ed.undo();
    expect(cels()[1]).toBe(cels()[0]);
  });

  it('unlinks merged frames when the upper layer differs', () => {
    const { ed, drag } = setup(4, 4);
    ed.duplicateLinkedFrame();
    ed.addLayer();
    drag('pencil', [3, 3], [3, 3]);
    ed.mergeDown();
    const cels = ed.sprite.layers[0].cels;
    expect(cels[1]).not.toBe(cels[0]);
    expect([cels[0][15], cels[1][15]]).toEqual([0, RED]);
  });
});

describe('Editor tags', () => {
  it('adds, edits and deletes tags with undo', () => {
    const { ed } = setup();
    ed.addFrame();
    ed.addFrame();
    ed.addTag({ name: 'walk', from: 0, to: 1 });
    expect(ed.getState().tags).toEqual([{ name: 'walk', from: 0, to: 1 }]);
    ed.updateTag(0, { name: 'run', to: 5 });
    expect(ed.getState().tags).toEqual([{ name: 'run', from: 0, to: 2 }]);
    ed.deleteTag(0);
    expect(ed.getState().tags).toEqual([]);
    ed.undo();
    ed.undo();
    expect(ed.getState().tags).toEqual([{ name: 'walk', from: 0, to: 1 }]);
    expect(ed.getState().dirty).toBe(true);
  });

  it('defaults a new tag to the current frame', () => {
    const { ed } = setup();
    ed.addFrame();
    ed.addTag();
    expect(ed.getState().tags).toEqual([{ name: 'Tag 1', from: 1, to: 1 }]);
  });

  it('moves tags along when frames are added and deleted', () => {
    const { ed } = setup();
    ed.addFrame();
    ed.addFrame();
    ed.addTag({ name: 'end', from: 2, to: 2 });
    ed.setFrame(0);
    ed.addFrame();
    expect(ed.getState().tags).toEqual([{ name: 'end', from: 3, to: 3 }]);
    ed.setFrame(3);
    ed.deleteFrame();
    expect(ed.getState().tags).toEqual([]);
    ed.undo();
    expect(ed.getState().tags).toEqual([{ name: 'end', from: 3, to: 3 }]);
    ed.undo();
    expect(ed.getState().tags).toEqual([{ name: 'end', from: 2, to: 2 }]);
  });

  it('plays in a loop inside the tag playback starts in', () => {
    const { ed } = setup();
    ed.addFrame();
    ed.addFrame();
    ed.addFrame();
    ed.addTag({ name: 'loop', from: 1, to: 2 });
    ed.setFrame(1);
    ed.setPlaying(true);
    const seen = [1];
    for (let i = 0; i < 4; i++) {
      ed.advancePlayback();
      seen.push(ed.getState().frame);
    }
    expect(seen).toEqual([1, 2, 1, 2, 1]);
    ed.setPlaying(false);
    ed.setFrame(3);
    ed.setPlaying(true);
    ed.advancePlayback();
    expect(ed.getState().frame).toBe(0);
  });
});
