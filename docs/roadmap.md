# Roadmap

Where Raster is headed. Every release aims to give something to each kind of
user: illustrators and icon makers, animators, and game developers. Order can
change; versions are targets, not promises. Ideas and votes are welcome in the
[issue tracker](https://github.com/J-isaac007/raster/issues).

Raster stays free, offline and private: no accounts, no cloud, no telemetry.

## 0.9: Game development

- Tilemap layers and tilesets
- Slices with 9-slice and pivot points, exported with the data
- Export presets: per tag, every frame as its own PNG, packed sheets, and the
  JSON formats Godot, Unity and Phaser read
- Open Aseprite files (`.ase`, `.aseprite`), and later save them
- Command-line export for build scripts

## 0.10: Animation and output

- APNG and animated WebP export
- Text tool with pixel fonts
- In-betweening help: move or rotate between two frames
- Tag playback direction (forward, reverse, ping-pong) and loop counts

## 1.0: Everywhere

- macOS and Linux builds
- Translations
- Accessibility: every panel reachable by keyboard, screen reader labels
- Scripting: add commands, tools and export formats with sandboxed scripts
- A stable, documented `.raster` format that every later version can read

## Done

- 0.1–0.2: drawing tools, selection, layers, animation, onion skin, GIF and
  sprite sheet export, palettes, pixel-perfect strokes, dithering, shading,
  tile mode, reference images
- 0.3: Windows desktop app, lasso and magic wand, tags, linked cels, indexed
  color
- 0.4: custom brushes, automatic updates
- 0.5: transform tools (RotSprite rotation, scaling, flips, crop, trim); a
  refreshed interface with tooltips and collapsible panels; a welcome screen
  with recent files; the command palette (`Ctrl+K`); Preferences
- 0.6: palette library with 28 built-in palettes and My palettes; import
  `.hex`, `.gpl`, `.pal`, `.txt`, `.act` and `.ase`; export `.hex`, `.gpl`,
  `.pal`; pixel grid off by default
- 0.6.1: transform with the mouse: drag handles on the canvas to scale and
  rotate, with the numbers in the tool options bar
- 0.7: color wheel and recent colors; hue-shifted ramps; gradient tool;
  rounded rectangles and polygons; the Adjust menu (hue/saturation, replace
  color, invert, desaturate, outline, drop shadow)
- 0.8: tabs for several sprites; layer groups; blend modes; reference layers;
  per-cel opacity; a layers × frames timeline (pick, drag, copy, scrub);
  onion skin range, tint and opacity
