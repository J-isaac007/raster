import { describe, expect, it } from 'vitest';
import { celOpacity, setCelOpacity } from './cels';
import { alpha, blend, blendMode, blue, green, red, rgba, BLEND_MODES } from './color';
import { parseProject, serializeProject } from './format';
import { groupSpan, moveItem, pruneGroups, stackRows, ungroup, wrapInGroup } from './groups';
import { composite, createGroup, createLayer, createSprite, mapCels, type Sprite } from './sprite';

const GRAY = rgba(128, 128, 128);
const RED = rgba(255, 0, 0);
const BLUE = rgba(0, 0, 255);
const rgb = (c: number) => [red(c), green(c), blue(c), alpha(c)];

describe('blend modes', () => {
  it('normal is exactly the old blend', () => {
    for (const [d, s, o] of [
      [GRAY, RED, 1],
      [GRAY, rgba(10, 200, 30, 90), 0.5],
      [0, RED, 0.3],
    ] as const) {
      expect(blendMode(d, s, o, 'normal')).toBe(blend(d, s, o));
    }
  });

  it('applies each formula over an opaque backdrop', () => {
    const b = rgba(200, 100, 50);
    const s = rgba(100, 200, 50);
    expect(rgb(blendMode(b, s, 1, 'multiply'))).toEqual([78, 78, 10, 255]);
    expect(rgb(blendMode(b, s, 1, 'screen'))).toEqual([222, 222, 90, 255]);
    expect(rgb(blendMode(b, s, 1, 'add'))).toEqual([255, 255, 100, 255]);
    expect(rgb(blendMode(b, s, 1, 'darken'))).toEqual([100, 100, 50, 255]);
    expect(rgb(blendMode(b, s, 1, 'lighten'))).toEqual([200, 200, 50, 255]);
    expect(rgb(blendMode(b, s, 1, 'difference'))).toEqual([100, 100, 0, 255]);
    // Overlay: dark backdrop channels multiply, light ones screen.
    expect(rgb(blendMode(b, s, 1, 'overlay'))).toEqual([188, 157, 20, 255]);
  });

  it('shows the source as is over transparency, and respects opacity', () => {
    for (const mode of BLEND_MODES) {
      expect(blendMode(0, RED, 1, mode)).toBe(RED);
      expect(blendMode(GRAY, RED, 0, mode)).toBe(GRAY);
    }
  });
});

/** A 1×1 sprite with the given layer colors, bottom first. */
function stack(...colors: number[]): Sprite {
  const sprite = createSprite(1, 1);
  sprite.layers = colors.map((c, i) => {
    const l = createLayer(1, 1, `L${i}`);
    l.pixels[0] = c;
    return l;
  });
  return sprite;
}

describe('compositing', () => {
  it('uses each layer’s blend mode and cel opacity', () => {
    const s = stack(rgba(200, 100, 50), rgba(100, 200, 50));
    s.layers[1].blendMode = 'multiply';
    expect(rgb(composite(s)[0])).toEqual([78, 78, 10, 255]);
    setCelOpacity(s.layers[1].pixels, 0);
    expect(composite(s)[0]).toBe(rgba(200, 100, 50));
  });

  it('composites a group on its own, then with its opacity and blend mode', () => {
    const s = stack(GRAY, RED, BLUE);
    const g = createGroup('G');
    s.groups.push(g);
    s.layers[1].groupId = g.id;
    s.layers[2].groupId = g.id;
    // Inside the group BLUE covers RED; the group then multiplies onto GRAY.
    g.blendMode = 'multiply';
    expect(rgb(composite(s)[0])).toEqual([0, 0, 128, 255]);
    g.visible = false;
    expect(composite(s)[0]).toBe(GRAY);
    g.visible = true;
    g.opacity = 0;
    expect(composite(s)[0]).toBe(GRAY);
  });

  it('passes Normal groups through, so blend modes inside reach below', () => {
    const s = stack(rgba(200, 100, 50), rgba(100, 200, 50));
    const g = createGroup('G');
    s.groups.push(g);
    s.layers[1].groupId = g.id;
    s.layers[1].blendMode = 'multiply';
    expect(rgb(composite(s)[0])).toEqual([78, 78, 10, 255]);
    g.opacity = 0;
    expect(composite(s)[0]).toBe(rgba(200, 100, 50));
  });

  it('nests groups', () => {
    const s = stack(GRAY, RED);
    const outer = createGroup('Outer');
    const inner = createGroup('Inner', outer.id);
    s.groups.push(outer, inner);
    s.layers[1].groupId = inner.id;
    inner.opacity = 0.5;
    outer.opacity = 0.5;
    // 25% red over gray.
    expect(composite(s)[0]).toBe(blend(GRAY, RED, 0.25));
  });

  it('leaves reference layers out of exports only', () => {
    const s = stack(GRAY, RED);
    s.layers[1].reference = true;
    expect(composite(s)[0]).toBe(RED);
    expect(composite(s, undefined, { forExport: true })[0]).toBe(GRAY);
  });
});

describe('cel opacity', () => {
  it('is shared by linked cels and survives remapping', () => {
    const cel = new Uint32Array(1);
    setCelOpacity(cel, 0.4);
    const [a, b] = mapCels([cel, cel], (c) => c.slice());
    expect(a).toBe(b);
    expect(celOpacity(a)).toBe(0.4);
    setCelOpacity(cel, 1);
    expect(celOpacity(cel)).toBe(1);
  });
});

describe('groups', () => {
  /** Layers A..D bottom to top; B and C in group G. */
  function grouped() {
    const s = stack(1, 2, 3, 4);
    const g = createGroup('G');
    s.groups.push(g);
    s.layers[1].groupId = g.id;
    s.layers[2].groupId = g.id;
    const names = () => s.layers.map((l) => `${l.name}${l.groupId ? '*' : ''}`).join(' ');
    return { s, g, names };
  }

  it('lists rows top first with groups above their contents', () => {
    const { s, g } = grouped();
    expect(
      stackRows(s.layers, s.groups).map((r) =>
        r.kind === 'group' ? `[${r.group.name}]` : r.layer.name,
      ),
    ).toEqual(['L3', '[G]', 'L2', 'L1', 'L0']);
    g.collapsed = true;
    expect(stackRows(s.layers, s.groups).map((r) => r.depth)).toEqual([0, 0, 0]);
  });

  it('steps a layer into and out of a group', () => {
    const { s, names } = grouped();
    const top = { kind: 'layer', id: s.layers[3].id } as const;
    moveItem(s, top, -1); // enters G at its top
    expect(names()).toBe('L0 L1* L2* L3*');
    moveItem(s, top, -1); // swaps with L2 inside G
    expect(names()).toBe('L0 L1* L3* L2*');
    moveItem(s, top, -1);
    moveItem(s, top, -1); // at G's bottom: steps out
    expect(names()).toBe('L0 L3 L1* L2*');
    moveItem(s, top, -1); // swaps with L0
    expect(names()).toBe('L3 L0 L1* L2*');
    expect(moveItem(s, top, -1)).toBe(false);
  });

  it('moves a whole group past a layer', () => {
    const { s, g, names } = grouped();
    moveItem(s, { kind: 'group', id: g.id }, 1);
    expect(names()).toBe('L0 L3 L1* L2*');
    expect(groupSpan(s, g.id)).toEqual([2, 3]);
  });

  it('wraps, ungroups and prunes empty groups', () => {
    const { s, g } = grouped();
    const outer = createGroup('Outer');
    wrapInGroup(s, { kind: 'group', id: g.id }, outer);
    expect(g.parentId).toBe(outer.id);
    ungroup(s, outer.id);
    expect(g.parentId).toBeNull();
    s.layers.splice(1, 2);
    pruneGroups(s);
    expect(s.groups).toEqual([]);
  });
});

describe('.raster v6', () => {
  it('round-trips groups, blend modes, reference layers and cel opacity', () => {
    const s = stack(GRAY, RED, BLUE);
    const outer = createGroup('Outer');
    const inner = createGroup('Inner', outer.id);
    Object.assign(inner, { opacity: 0.5, blendMode: 'screen', collapsed: true });
    s.groups.push(outer, inner);
    s.layers[1].groupId = inner.id;
    s.layers[2].groupId = outer.id;
    s.layers[2].blendMode = 'difference';
    s.layers[0].reference = true;
    setCelOpacity(s.layers[1].cels[0], 0.25);

    const back = parseProject(serializeProject({ sprite: s, palette: [] })).sprite;
    expect(back.groups.map((g) => g.name)).toEqual(['Outer', 'Inner']);
    const [bo, bi] = back.groups;
    expect(bi).toMatchObject({
      parentId: bo.id,
      opacity: 0.5,
      blendMode: 'screen',
      collapsed: true,
    });
    expect(back.layers.map((l) => l.groupId)).toEqual([null, bi.id, bo.id]);
    expect(back.layers[2].blendMode).toBe('difference');
    expect(back.layers[0].reference).toBe(true);
    expect(celOpacity(back.layers[1].cels[0])).toBe(0.25);
    expect(composite(back)[0]).toBe(composite(s)[0]);
  });

  it('reads version 5 files with defaults', () => {
    const v5 = JSON.stringify({
      format: 'raster',
      version: 5,
      width: 1,
      height: 1,
      palette: [],
      frames: [{ duration: 100 }],
      layers: [{ name: 'A', visible: true, locked: false, opacity: 1, cels: ['AAAAAA=='] }],
    });
    const { sprite } = parseProject(v5);
    expect(sprite.groups).toEqual([]);
    expect(sprite.layers[0]).toMatchObject({
      blendMode: 'normal',
      reference: false,
      groupId: null,
    });
  });

  it('drops groups with bad parents or no layers', () => {
    const text = JSON.stringify({
      format: 'raster',
      version: 6,
      width: 1,
      height: 1,
      palette: [],
      frames: [{ duration: 100 }],
      groups: [
        {
          name: 'Loop A',
          parent: 1,
          visible: true,
          opacity: 1,
          blendMode: 'nope',
          collapsed: false,
        },
        {
          name: 'Loop B',
          parent: 0,
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          collapsed: false,
        },
        {
          name: 'Empty',
          parent: null,
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          collapsed: false,
        },
      ],
      layers: [
        { name: 'A', visible: true, locked: false, opacity: 1, group: 0, cels: ['AAAAAA=='] },
      ],
    });
    const { sprite } = parseProject(text);
    // The loop is broken at Loop A; Loop B and Empty hold no layers and go.
    expect(sprite.groups.map((g) => [g.name, g.parentId, g.blendMode])).toEqual([
      ['Loop A', null, 'normal'],
    ]);
    expect(sprite.layers[0].groupId).toBe(sprite.groups[0].id);
  });
});
