# Roadmap

Where Raster is headed. Every release aims to give something to each kind of
user: illustrators and icon makers, animators, and game developers. Order can
change; versions are targets, not promises. Ideas and votes are welcome in the
[issue tracker](https://github.com/J-isaac007/raster/issues).

Raster stays free, offline and private: no accounts, no cloud, no telemetry.

## 0.6: Color and paint

- HSV/HSL color wheel and recent colors
- Color ramps with hue shifting, added straight to the palette
- Gradient tool, linear or radial, with dithered steps
- Adjust hue, saturation and lightness; replace color; invert; desaturate
- Outline and drop shadow effects
- More shapes: filled, rounded rectangles, polygons

## 0.7: Documents and layers

- Several sprites open at once, in tabs
- Layer groups
- Blend modes: multiply, screen, overlay, add, darken, lighten, difference
- Per-cel opacity and reference layers (shown, never exported)
- A better timeline: select many frames and cels, drag to move or copy, scrub
- More onion skin options: how many frames, tint colors, opacity

## 0.8: Game development

- Tilemap layers and tilesets
- Slices with 9-slice and pivot points, exported with the data
- Export presets: per tag, every frame as its own PNG, packed sheets, and the
  JSON formats Godot, Unity and Phaser read
- Open Aseprite files (`.ase`, `.aseprite`), and later save them
- Command-line export for build scripts

## 0.9: Animation and output

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
- 0.5 (next release): transform tools (RotSprite rotation, scaling, flips,
  crop, trim); a refreshed interface with tooltips and collapsible panels; a
  welcome screen with recent files; the command palette (`Ctrl+K`);
  Preferences
