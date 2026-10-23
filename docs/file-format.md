# The `.raster` file format

A `.raster` file is UTF-8 JSON. Version 4 looks like this:

```json
{
  "format": "raster",
  "version": 4,
  "width": 32,
  "height": 32,
  "palette": ["#000000", "#ff004d", "#29adff80"],
  "colorMode": "rgb",
  "frames": [{ "duration": 100 }, { "duration": 150 }, { "duration": 100 }],
  "tags": [{ "name": "walk", "from": 0, "to": 1 }],
  "layers": [
    {
      "name": "Layer 1",
      "visible": true,
      "locked": false,
      "opacity": 1,
      "cels": ["AAAA…", "AAAA…", { "link": 0 }]
    }
  ]
}
```

| Field       | Meaning                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `format`    | Always `"raster"`.                                                                             |
| `version`   | Format version. Readers must refuse versions newer than they know.                             |
| `width`     | Sprite width in pixels, 1–2048.                                                                |
| `height`    | Sprite height in pixels, 1–2048.                                                               |
| `palette`   | Colors as `#rrggbb` or `#rrggbbaa`.                                                            |
| `colorMode` | `"rgb"` or `"indexed"`. Missing means `"rgb"`.                                                 |
| `frames`    | Animation frames in order, 1–1000. `duration` is in milliseconds.                              |
| `tags`      | Named frame ranges (animation loops). `from` and `to` are 0-based, both included.              |
| `layers`    | Bottom to top. At least one.                                                                   |
| `opacity`   | Layer opacity from 0 to 1.                                                                     |
| `cels`      | One image per frame: base64 of raw RGBA bytes, row-major from the top-left, or `{ "link": n }` |

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
