# The `.raster` file format

A `.raster` file is UTF-8 JSON. Version 6 looks like this:

```json
{
  "format": "raster",
  "version": 6,
  "width": 32,
  "height": 32,
  "palette": ["#000000", "#ff004d", "#29adff80"],
  "colorMode": "rgb",
  "recentColors": ["#ef7d57", "#29adff"],
  "frames": [{ "duration": 100 }, { "duration": 150 }, { "duration": 100 }],
  "tags": [{ "name": "walk", "from": 0, "to": 1 }],
  "groups": [
    {
      "name": "Body",
      "parent": null,
      "visible": true,
      "opacity": 1,
      "blendMode": "normal",
      "collapsed": false
    }
  ],
  "layers": [
    {
      "name": "Layer 1",
      "visible": true,
      "locked": false,
      "opacity": 1,
      "blendMode": "normal",
      "reference": false,
      "group": null,
      "cels": ["AAAA…", { "data": "AAAA…", "opacity": 0.5 }, { "link": 0 }]
    },
    {
      "name": "Shading",
      "visible": true,
      "locked": false,
      "opacity": 1,
      "blendMode": "multiply",
      "reference": false,
      "group": 0,
      "cels": ["AAAA…", "AAAA…", "AAAA…"]
    }
  ]
}
```

| Field          | Meaning                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `format`       | Always `"raster"`.                                                                             |
| `version`      | Format version. Readers must refuse versions newer than they know.                             |
| `width`        | Sprite width in pixels, 1–2048.                                                                |
| `height`       | Sprite height in pixels, 1–2048.                                                               |
| `palette`      | Colors as `#rrggbb` or `#rrggbbaa`.                                                            |
| `colorMode`    | `"rgb"` or `"indexed"`. Missing means `"rgb"`.                                                 |
| `recentColors` | Recently used drawing colors, newest first, as `#rrggbb` or `#rrggbbaa`. At most 16.           |
| `frames`       | Animation frames in order, 1–1000. `duration` is in milliseconds.                              |
| `tags`         | Named frame ranges (animation loops). `from` and `to` are 0-based, both included.              |
| `layers`       | Bottom to top. At least one.                                                                   |
| `opacity`      | Layer opacity from 0 to 1.                                                                     |
| `blendMode`    | `normal`, `multiply`, `screen`, `overlay`, `add`, `darken`, `lighten` or `difference`.         |
| `reference`    | A reference layer: shown while drawing, left out of exports.                                   |
| `group`        | Index into `groups` of the layer's innermost group, or `null` at the top level.                |
| `groups`       | Layer groups. `parent` is an index into the same list, or `null`.                              |
| `cels`         | One image per frame: base64 of raw RGBA bytes, row-major from the top-left, or `{ "link": n }` |

Each cel decodes to exactly `width × height × 4` bytes. Colors use straight
(not premultiplied) alpha.

A cel written as `{ "link": n }` is a linked cel: it is the same image as
frame `n` of the same layer, and `n` must be an earlier frame. Editing a
linked cel changes every frame linked to it.

In `"indexed"` mode every pixel is either fully transparent or one of the
`palette` colors, and the editor keeps it that way. Pixels still store full
RGBA, so readers that ignore `colorMode` see the same image.

Readers clamp tag ranges to the frames that exist and skip tags without
numeric `from` and `to`.

The reference image overlay and view settings (zoom, grid, tile mode) are not
saved in the file.

## Version 6

Version 6 added layer groups, blend modes, reference layers and cel opacity.

- `groups` lists the groups; each layer's `group` points at its innermost
  one. A group's layers are a contiguous run of `layers`. Groups nest through
  `parent`; readers drop groups that hold no layers and break parent loops.
- `blendMode` on a layer or group says how it combines with what's below.
  Missing or unknown values mean `normal`. A group whose mode is `normal`
  passes through: its layers composite straight onto what's below, scaled by
  the group's opacity. A group with another mode composites its layers on
  their own first, then blends the result with its opacity and mode.
- `reference: true` marks a layer that is shown but never exported.
- A cel may be `{ "data": "…", "opacity": 0.5 }`: its image plus an opacity
  from 0 to 1 that multiplies the layer's. Linked cels share the opacity of
  the cel they link to.

## Version 5

Version 5 added `recentColors`: the drawing colors most recently set with the
color wheel, the hex field or the system color dialog, or picked from the
canvas, newest first, at most 16, without repeats. They belong to the
document, so each file keeps its own. Readers skip entries that aren't valid
colors, drop repeats and keep the first 16.

## Version 4

Version 4 had no `recentColors`. Readers treat it as an empty list.

## Version 3

Version 3 had no `colorMode`. Readers treat it as `"rgb"`.

## Version 2

Version 2 had no `tags`, and every cel was a base64 string (no links).

## Version 1

Version 1 had no `frames`, and each layer stored its single image in `data`
instead of `cels`. Readers treat it as one frame of 100 ms.

## Compatibility

The reference reader and writer live in [`src/renderer/src/core/format.ts`](../src/renderer/src/core/format.ts).
Any change to the format must bump `version` and keep reading older files.
