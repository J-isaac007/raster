# The `.raster` file format

A `.raster` file is UTF-8 JSON. Version 2 looks like this:

```json
{
  "format": "raster",
  "version": 2,
  "width": 32,
  "height": 32,
  "palette": ["#000000", "#ff004d", "#29adff80"],
  "frames": [{ "duration": 100 }, { "duration": 150 }],
  "layers": [
    {
      "name": "Layer 1",
      "visible": true,
      "locked": false,
      "opacity": 1,
      "cels": ["AAAA…", "AAAA…"]
    }
  ]
}
```

| Field     | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `format`  | Always `"raster"`.                                                         |
| `version` | Format version. Readers must refuse versions newer than they know.         |
| `width`   | Sprite width in pixels, 1–2048.                                            |
| `height`  | Sprite height in pixels, 1–2048.                                           |
| `palette` | Colors as `#rrggbb` or `#rrggbbaa`.                                        |
| `frames`  | Animation frames in order, 1–1000. `duration` is in milliseconds.          |
| `layers`  | Bottom to top. At least one.                                               |
| `opacity` | Layer opacity from 0 to 1.                                                 |
| `cels`    | One image per frame: base64 of raw RGBA bytes, row-major from the top-left |

Each cel decodes to exactly `width × height × 4` bytes. Colors use straight
(not premultiplied) alpha.

The reference image overlay and view settings (zoom, grid, tile mode) are not
saved in the file.

## Version 1

Version 1 had no `frames`, and each layer stored its single image in `data`
instead of `cels`. Readers treat it as one frame of 100 ms.

## Compatibility

The reference reader and writer live in [`src/core/format.ts`](../src/core/format.ts).
Any change to the format must bump `version` and keep reading older files.
