import { describe, expect, it } from 'vitest';
import { rgba } from './color';
import { FormatError, parseProject, serializeProject } from './format';
import { formatHexPalette, parsePalette } from './palette';
import { createLayer, createSprite } from './sprite';

describe('.raster format', () => {
  it('round-trips a project', () => {
    const sprite = createSprite(3, 2);
    sprite.layers[0].pixels.set([rgba(1, 2, 3), 0, rgba(4, 5, 6, 7)]);
    const top = createLayer(3, 2, 'Ink');
    top.opacity = 0.25;
    top.visible = false;
    top.locked = true;
    top.pixels[5] = rgba(255, 255, 255);
    sprite.layers.push(top);
    const palette = [rgba(10, 20, 30), rgba(40, 50, 60, 70)];

    const loaded = parseProject(serializeProject({ sprite, palette }));

    expect(loaded.sprite.width).toBe(3);
    expect(loaded.sprite.height).toBe(2);
    expect(loaded.palette).toEqual(palette);
    expect(loaded.sprite.layers.map((l) => l.name)).toEqual(['Layer 1', 'Ink']);
    expect([...loaded.sprite.layers[0].pixels]).toEqual([...sprite.layers[0].pixels]);
    expect(loaded.sprite.layers[1]).toMatchObject({ opacity: 0.25, visible: false, locked: true });
    expect([...loaded.sprite.layers[1].pixels]).toEqual([...top.pixels]);
  });

  it('saves linked cels once and keeps them linked', () => {
    const sprite = createSprite(1, 1, 3);
    const layer = sprite.layers[0];
    layer.cels[2] = layer.cels[0];
    layer.cels[0][0] = rgba(9, 9, 9);
    const text = serializeProject({ sprite, palette: [] });
    expect(JSON.parse(text).layers[0].cels[2]).toEqual({ link: 0 });

    const loaded = parseProject(text).sprite.layers[0];
    expect(loaded.cels[2]).toBe(loaded.cels[0]);
    expect(loaded.cels[1]).not.toBe(loaded.cels[0]);
    expect(loaded.cels[2][0]).toBe(rgba(9, 9, 9));
    expect(loaded.pixels).toBe(loaded.cels[0]);
  });

  it('round-trips tags and drops broken ones', () => {
    const sprite = createSprite(1, 1, 4);
    sprite.tags = [{ name: 'walk', from: 1, to: 3 }];
    expect(parseProject(serializeProject({ sprite, palette: [] })).sprite.tags).toEqual([
      { name: 'walk', from: 1, to: 3 },
    ]);

    const json = JSON.parse(serializeProject({ sprite, palette: [] }));
    json.tags = [{ name: 'far', from: 2, to: 99 }, { name: 'bad' }];
    expect(parseProject(JSON.stringify(json)).sprite.tags).toEqual([
      { name: 'far', from: 2, to: 3 },
    ]);
  });

  it('reads version 2 files, which have no tags or links', () => {
    const json = JSON.parse(serializeProject({ sprite: createSprite(1, 1, 2), palette: [] }));
    json.version = 2;
    delete json.tags;
    const { sprite } = parseProject(JSON.stringify(json));
    expect(sprite.tags).toEqual([]);
    expect(sprite.layers[0].cels[1]).not.toBe(sprite.layers[0].cels[0]);
  });

  it('round-trips indexed color mode and reads older files as RGB', () => {
    const sprite = createSprite(1, 1);
    expect(parseProject(serializeProject({ sprite, palette: [], indexed: true })).indexed).toBe(
      true,
    );
    const json = JSON.parse(serializeProject({ sprite, palette: [] }));
    expect(json.colorMode).toBe('rgb');
    json.version = 3;
    delete json.colorMode;
    expect(parseProject(JSON.stringify(json)).indexed).toBe(false);
  });

  it('rejects links to the same or a later frame', () => {
    const json = JSON.parse(serializeProject({ sprite: createSprite(1, 1, 2), palette: [] }));
    json.layers[0].cels[0] = { link: 1 };
    expect(() => parseProject(JSON.stringify(json))).toThrow(/cel link/);
  });

  it('rejects bad input with a FormatError', () => {
    expect(() => parseProject('nope')).toThrow(FormatError);
    expect(() => parseProject('{"format":"other"}')).toThrow(FormatError);
    expect(() =>
      parseProject(JSON.stringify({ format: 'raster', version: 99, width: 1, height: 1 })),
    ).toThrow(/version/);
    expect(() =>
      parseProject(
        JSON.stringify({
          format: 'raster',
          version: 1,
          width: 2,
          height: 2,
          layers: [{ name: 'x', data: 'AAAA' }],
        }),
      ),
    ).toThrow(/pixel data/);
  });
});

describe('palette files', () => {
  it('parses .hex lists', () => {
    expect(parsePalette('ff0000\n00ff00\n\n#0000ff\nnot a color\n')).toEqual([
      rgba(255, 0, 0),
      rgba(0, 255, 0),
      rgba(0, 0, 255),
    ]);
  });

  it('parses GIMP palettes', () => {
    const gpl = 'GIMP Palette\nName: Test\nColumns: 4\n#\n255   0   0\tRed\n  0 128 255 Blue\n';
    expect(parsePalette(gpl)).toEqual([rgba(255, 0, 0), rgba(0, 128, 255)]);
  });

  it('writes .hex', () => {
    expect(formatHexPalette([rgba(255, 0, 0), rgba(0, 0, 0, 128)])).toBe('ff0000\n00000080\n');
  });
});

describe('.raster frames', () => {
  it('round-trips frames and durations', () => {
    const sprite = createSprite(2, 1, 3);
    sprite.frames[1].duration = 250;
    sprite.layers[0].cels[2][1] = rgba(9, 9, 9);
    const loaded = parseProject(serializeProject({ sprite, palette: [] })).sprite;
    expect(loaded.frames.map((f) => f.duration)).toEqual([100, 250, 100]);
    expect(loaded.layers[0].cels[2][1]).toBe(rgba(9, 9, 9));
    expect(loaded.layers[0].pixels).toBe(loaded.layers[0].cels[0]);
  });

  it('still reads version 1 files', () => {
    const v1 = {
      format: 'raster',
      version: 1,
      width: 1,
      height: 1,
      palette: [],
      layers: [
        { name: 'Old', visible: true, locked: false, opacity: 1, data: btoa('\x01\x02\x03\xff') },
      ],
    };
    const { sprite } = parseProject(JSON.stringify(v1));
    expect(sprite.frames).toHaveLength(1);
    expect(sprite.layers[0].pixels[0]).toBe(rgba(1, 2, 3));
  });
});
