import { describe, expect, it } from 'vitest';
import { celOpacity } from '@core/cels';
import { RED, setup } from './testing';

/** Three layers L1..L3 (bottom to top), L3 active. */
function three() {
  const t = setup(2, 2);
  t.ed.addLayer();
  t.ed.addLayer();
  const names = () => t.ed.sprite.layers.map((l) => `${l.name}${l.groupId ? '*' : ''}`).join(' ');
  return { ...t, names };
}

describe('Editor groups', () => {
  it('groups the active layer and undoes it', () => {
    const { ed, names } = three();
    ed.groupLayers();
    const { groups, activeGroupId } = ed.getState();
    expect(groups).toHaveLength(1);
    expect(activeGroupId).toBe(groups[0].id);
    expect(names()).toBe('Layer 1 Layer 2 Layer 3*');
    ed.undo();
    expect(ed.getState().groups).toHaveLength(0);
    expect(names()).toBe('Layer 1 Layer 2 Layer 3');
    ed.redo();
    expect(ed.getState().groups).toHaveLength(1);
  });

  it('adds new layers inside the picked group and moves layers into it', () => {
    const { ed, names } = three();
    ed.groupLayers();
    ed.addLayer();
    expect(names()).toBe('Layer 1 Layer 2 Layer 3* Layer 4*');
    ed.setActiveLayer(ed.sprite.layers[1].id);
    ed.moveLayer(null, 1); // Layer 2 steps into the group above it
    expect(names()).toBe('Layer 1 Layer 2* Layer 3* Layer 4*');
    ed.undo();
    expect(names()).toBe('Layer 1 Layer 2 Layer 3* Layer 4*');
  });

  it('deletes a picked group with its layers, and ungroups', () => {
    const { ed, names } = three();
    ed.groupLayers();
    const id = ed.getState().activeGroupId!;
    ed.ungroup();
    expect(ed.getState().groups).toHaveLength(0);
    ed.undo();
    ed.setActiveGroup(id);
    ed.deleteLayer();
    expect(names()).toBe('Layer 1 Layer 2');
    expect(ed.getState().groups).toHaveLength(0);
    ed.undo();
    expect(names()).toBe('Layer 1 Layer 2 Layer 3*');
  });

  it('only merges down within a group, and never reference layers', () => {
    const { ed } = three();
    ed.groupLayers();
    ed.setActiveLayer(ed.sprite.layers[2].id);
    ed.mergeDown();
    expect(ed.sprite.layers).toHaveLength(3);
    expect(ed.getState().message).toBe('No layer below in this group');
    ed.setActiveLayer(ed.sprite.layers[1].id);
    ed.updateLayer(ed.sprite.layers[1].id, { reference: true });
    ed.mergeDown();
    expect(ed.sprite.layers).toHaveLength(3);
  });

  it('refuses to draw on a layer in a hidden group', () => {
    const { ed, px, drag } = three();
    ed.groupLayers();
    ed.updateGroup(ed.getState().activeGroupId!, { visible: false });
    drag('pencil', [0, 0], [0, 0]);
    expect(px(0, 0)).toBe(0);
    expect(ed.getState().message).toBe('Layer is in a hidden group');
  });

  it('sets blend mode, reference and group properties undoably', () => {
    const { ed } = three();
    const id = ed.getState().activeLayerId;
    ed.updateLayer(id, { blendMode: 'screen' });
    ed.updateLayer(id, { reference: true });
    expect(ed.getState().layers.at(-1)).toMatchObject({ blendMode: 'screen', reference: true });
    ed.undo();
    ed.undo();
    expect(ed.getState().layers.at(-1)).toMatchObject({ blendMode: 'normal', reference: false });
    ed.groupLayers();
    const g = ed.getState().activeGroupId!;
    ed.updateGroup(g, { name: 'Body', opacity: 0.5, blendMode: 'multiply' });
    expect(ed.getState().groups[0]).toMatchObject({
      name: 'Body',
      opacity: 0.5,
      blendMode: 'multiply',
    });
    ed.undo();
    expect(ed.getState().groups[0]).toMatchObject({ opacity: 1, blendMode: 'normal' });
  });

  it('sets cel opacity, shared by linked cels and kept by duplicates', () => {
    const { ed, drag } = setup(2, 2);
    drag('pencil', [0, 0], [0, 0]);
    ed.duplicateLinkedFrame();
    const layer = ed.activeLayer;
    ed.setCelOpacity(layer.id, [0], 0.5);
    expect(celOpacity(layer.cels[1])).toBe(0.5);
    ed.setFrame(0);
    ed.duplicateFrame();
    expect(layer.cels[1]).not.toBe(layer.cels[0]);
    expect(celOpacity(layer.cels[1])).toBe(0.5);
    ed.undo();
    ed.undo();
    expect(celOpacity(layer.cels[0])).toBe(1);
    expect(layer.cels[0][0]).toBe(RED);
  });
});
