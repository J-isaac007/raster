# Changelog

All notable changes to Raster are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-19

### Added

- Canvas with zoom at cursor, pan (Space/middle mouse), pixel grid and zoom to fit.
- Tools: pencil, eraser, flood fill (contiguous or global), line, rectangle and
  ellipse (outline or filled), color picker. Brush sizes 1–32 px.
- Horizontal and vertical symmetry drawing.
- Primary/secondary colors with alpha, hex input and palette presets.
- Palette import/export (`.hex`, `.gpl`).
- Layers: add, duplicate, delete, reorder, merge down, rename, opacity,
  visibility and lock.
- Undo/redo for every document change.
- Canvas resize with anchor, sprite and layer flips.
- `.raster` project files, PNG import and scaled PNG export.
- Autosave to browser storage.
- Rectangle selection tool (`M`). Drawing tools stay inside the selection,
  and dragging inside it moves the pixels as one undo step.
- Cut, copy, paste, delete, select all and deselect (`Ctrl+X`, `Ctrl+C`,
  `Ctrl+V`, `Delete`, `Ctrl+A`, `Ctrl+D`). Paste also accepts images copied
  from other apps.
- Animation: frames with per-frame durations, a timeline with thumbnails,
  playback (`Enter`), frame stepping (`←` `→`) and onion skinning (`Shift+O`).
- Export as animated GIF or sprite sheet (PNG plus JSON frame data in the
  common "array" layout game engines read). Animated GIFs import as frames.
- Shade tool (`D`): lightens or darkens along palette ramps.
- Pixel-perfect strokes for the pencil and eraser.
- Ordered dithering for the pencil, shapes and fill.
- Tile mode (`Shift+T`): the canvas repeats around itself and strokes wrap
  across edges, for seamless textures. Configurable tile grid (`Shift+G`).
- Reference image overlay, shown behind or over the art at any opacity.
- Installable as an app (PWA) that works offline and opens `.raster` files
  from the OS. Files can also be dropped onto the window.
