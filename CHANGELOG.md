# Changelog

All notable changes to Raster are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.8.0] - 2026-11-11

### Added

- Tabs: open several sprites at once. New sprites and opened files each get
  their own tab (an untouched untitled tab is reused), and opening a file
  that's already open switches to it. Each tab keeps its own undo history and
  file. `Ctrl+Tab` / `Ctrl+Shift+Tab` switch tabs; `Ctrl+W` (or a
  middle-click) closes one, asking first if it has unsaved changes. The title
  bar follows the active tab, and quitting warns if any tab is unsaved.
  Autosave keeps every tab and reopens them all.
- Layer groups: Layer › Group Layers (`Ctrl+G`) and Ungroup
  (`Ctrl+Shift+G`). Groups nest, fold, hide everything in them, and move
  up and down as one. A group with the Normal blend mode passes through, so
  blend modes inside it still reach the layers below; give it another mode to
  composite it on its own first.
- Blend modes for layers and groups: Normal, Multiply, Screen, Overlay, Add,
  Darken, Lighten and Difference. They also apply when merging down.
- Reference layers: shown while you draw, left out of every export (PNG,
  GIF and sprite sheets). Tick Reference layer on the Layer panel.
- Per-cel opacity: Frame › Cel Properties… (or double-click a cel) sets the
  opacity of the picked cels, on top of the layer's opacity. Linked cels
  share it.
- The timeline is now a grid of layers × frames. Layers (with their groups)
  are listed on the left, frames across the top, and each cel shows as a dot:
  filled when it has pixels, a ring when empty, joined by a bar when linked.
  - Click a cel to pick it; Shift-click or drag to pick a block of cels. Drag
    picked cels to move them to other frames or layers; hold `Ctrl` to copy.
  - Click a frame number to pick it, drag along the numbers to scrub, and
    drag picked frames to move them; hold `Ctrl` to copy. A blue bar shows
    where they'll land, and `Escape` cancels.
  - Duplicate Frame and Delete Frame act on all picked frames.
  - Every move or copy is one undo step. `Alt+←` / `Alt+→` still move the
    current frame.
- Onion skin options (the arrow next to the onion skin button): how many
  frames to show before and after (up to 4 each, fading with distance), their
  opacity, and whether to tint them, with your own before and after colors.
  They're saved with your preferences.

### Changed

- The Layers panel became the Layer panel: it shows the picked layer's or
  group's opacity, blend mode and reference setting. The layer list itself is
  the timeline's left column.
- Frame thumbnails in the timeline gave way to the cel grid.
- `.raster` files are now version 6, which adds groups, blend modes,
  reference layers and cel opacity. Older files open as before.

### Fixed

- In a short window the canvas no longer overlaps the timeline; the toolbar
  scrolls instead.

## [0.7.0] - 2026-11-11

### Added

- Color picker in the Color panel: drag in the saturation/brightness square
  and along the hue bar to pick a color.
- Recent colors: the colors you pick show as swatches under the wheel (left
  click sets the primary color, right click the secondary). They're saved with
  the sprite and in the autosave.
- Palette › New Ramp…: builds a hue-shifted ramp around the primary color,
  with shadows turning toward blue and highlights toward yellow, and puts it
  into the palette around that color, ready for the Shade tool.
- Gradient tool (`R`): linear or radial, from the primary to the secondary
  color in ordered-dither steps. It fills the selection, or the whole layer.
  Right-drag swaps the colors, and `Shift` snaps the angle.
- Polygon tool (`P`): regular polygons with 3 to 12 sides, outlined or
  filled. Drag from the center to a corner; `Shift` snaps the rotation to 15°.
- Rounded rectangles: a Radius setting on the Rectangle tool.
- Adjust menu, acting on the selection or the whole layer:
  - Hue/Saturation… (`Ctrl+U`): shift hue, saturation and lightness.
  - Replace Color…: swap one color for another, with a tolerance.
  - Invert, and Desaturate (`Ctrl+Shift+U`).
  - Outline…: draw a one-pixel outline around the art in any color, with or
    without diagonal corners.
  - Drop Shadow…: add an offset shadow in any color.

  The dialogs sit beside the canvas so the art stays in view, preview live,
  and apply as one undo step. In indexed color, results snap to the palette.

### Changed

- `.raster` files are now version 5, which adds the sprite's recent colors.
  Older files open as before. - 2026-11-10

### Fixed

- Scaling and rotating no longer means typing numbers into a dialog: you can
  now do it with the mouse, right on the canvas. Edit › Transform (`Ctrl+T`)
  puts a box with eight handles around the selection, or around the active
  layer's art when nothing is selected.
  - Drag a corner to scale both sides, or an edge to scale one.
  - Drag just outside a corner, or the knob above the top edge, to rotate.
  - Drag inside the box to move.
  - `Shift` keeps proportions (on corners it switches Keep proportions while
    held) and snaps rotation to 15°. `Alt` scales from the center.
  - The preview follows the pointer with fast nearest-neighbor sampling and
    switches to RotSprite when you let go, so dragging stays smooth on big
    layers.
  - `Enter` (or `Ctrl+T` again, or a click away from the box) applies the
    transform as one undo step. `Escape` or Undo cancels it.
- The numbers are still there: while transforming, the tool options bar shows
  Angle with 15°, 30°, 45°, 90° and 180° presets, Width and Height in percent,
  Keep proportions, and Cancel and Apply, all kept in sync with the handles.
  The Transform dialog they used to live in is gone. The status bar reads the
  size, scale and angle, for example `Transform 20 × 18 · 125% × 125% · 15°`.
- Starting a transform switches to the Select tool, so the result can be
  dragged into place before it settles.

## [0.6.0] - 2026-11-10

### Added

- Palette library: Palette › Browse Palettes… (`Ctrl+Alt+P`, or Browse
  palettes… on the Palette panel). Search 28 built-in palettes, grouped as
  Popular, Consoles & computers, Small & 1-bit and Ramps, each credited to
  its author (docs/palettes.md). Use a palette, or add only the colors you
  don't have yet.
- My palettes: imported and saved palettes are kept in `settings.json` and
  can be renamed or deleted. Palette › Save Current Palette… adds the
  sprite's palette.
- Palette › Import Palette… reads `.hex`, GIMP `.gpl`, JASC `.pal`,
  Paint.NET `.txt`, Adobe Color Table `.act` and Adobe Swatch Exchange `.ase`
  (RGB, CMYK, grayscale and Lab swatches). Dropping a palette file on the
  window imports it too.
- Palette › Export Palette… saves `.hex`, `.gpl` or `.pal`, chosen in the
  save dialog.

### Changed

- New sprites still start with PICO-8. The Game Boy palette now uses the bgb
  emulator's colors, as published on Lospec.
- The preset dropdown on the Palette panel is replaced by the palette browser.
- The pixel grid is now off by default, so pixels show without outlines.
  Turn it on with View › Toggle Pixel Grid (`Ctrl+'`) or in Preferences.

## [0.5.0] - 2026-10-24

### Added

- Command palette (`Ctrl+K`, or the search box in the menu bar): find and run
  any command by name, or open a recent file.
- Welcome screen with new-sprite size presets and recent files. It shows at
  startup when there's no sprite to reopen, and from Help › Welcome Screen.
- Recent files in the File menu, the welcome screen and the taskbar jump list.
- Preferences (`Ctrl+,`): accent color, checkerboard size, pixel grid color
  and visibility, autosave, reopening the last sprite, and the update check.
  They're saved in `settings.json` in Raster's data folder.
- Transform tools. Edit › Transform… (`Ctrl+T`) rotates the selection by any
  angle and scales it, with a live preview. Rotation uses RotSprite, so lines
  stay crisp and no new colors appear. Edit also flips (`Shift+H`, `Shift+V`)
  and turns the selection by quarter turns; with nothing selected, these act
  on the whole layer.
- Sprite › Sprite Size… (`Ctrl+Alt+I`) scales every layer and frame without
  blurring. Sprite › Rotate turns the whole sprite a quarter or half turn.
- Sprite › Crop to Selection and Sprite › Trim Empty Edges.
- A privacy policy (docs/privacy.md). The installer shows the privacy notice
  and license before installing.
- An architecture guide for contributors (docs/architecture.md).

### Changed

- The code now follows the standard Electron layout: a typed main process,
  preload script and page under `src/`, one shared IPC contract, and
  renderer layers whose import rules are checked by the linter. No change
  in how the app behaves.
- Refreshed interface. Consistent spacing, control sizes and type throughout,
  with Inter and JetBrains Mono bundled so it looks the same everywhere. Every
  icon button shows a tooltip with its shortcut. Side panel sections collapse
  (and stay collapsed). Tool help moved to the status bar, which also has zoom
  buttons. Messages appear as a toast over the canvas.
- The canvas background is a plain white and light gray checkerboard, without
  the colored bands.
- Flip Layer moved from the Layer menu to Edit › Flip Horizontal / Vertical
  (same shortcuts). It flips the selection when there is one.

## [0.4.0] - 2026-10-20

### Added

- Custom brushes: select an area and press `Ctrl+B` (Edit › New Brush from
  Selection) to paint with it. The pencil, eraser, shade and shape tools stamp
  it, centered on the cursor, with symmetry and dithering. Choose whether it
  paints its own colors or the current color in its shape. `Ctrl+Shift+B`, the
  brush size slider or the × in the tool bar go back to the square brush.
- Automatic updates for the installed app. Raster checks GitHub Releases when
  it starts, downloads new versions in the background and shows **Restart to
  update** when one is ready. Help › Check for Updates checks now; Help ›
  About Raster turns the startup check off. The portable version doesn't
  update itself.

### Note

- Automatic updates start with this version. Install it once by hand; later
  versions arrive on their own.

## [0.3.0] - 2026-10-20

### Added

- Lasso (`Q`) and magic wand (`W`) selection. Hold `Shift` to add to the
  selection or `Ctrl` to subtract from it. The wand can select one connected
  area or every pixel of a color.
- Edit › Invert Selection (`Ctrl+Shift+I`).
- Animation tags: name a range of frames (`Alt+T`, or the tag button in the
  timeline). Playback loops inside the tag it starts in. Tags are saved, and
  GIF and sprite sheet exports can export one tag; sprite sheet JSON lists
  them as `frameTags`.
- Linked cels: Frame › Duplicate Linked Frame (`Shift+Alt+D`) adds a frame
  that shares its images with the current one, so drawing on either changes
  both. Frame › Unlink Cel gives a frame its own copy again. Linked frames
  show a link mark in the timeline.
- Palette swapping: double-click a palette color (or Palette › Swap Palette
  Color…) to change it, and every pixel of that color changes with it, in all
  layers and frames, as one undo step.
- Indexed color mode (`Shift+I`, or the Indexed button on the palette). It
  snaps every pixel and drawing color to the nearest palette color and keeps
  them there. In indexed mode, picking a preset or loading a palette of the
  same size swaps colors by position; removing a color moves its pixels to the
  nearest one left.

### Changed

- The `.raster` format is now version 4 (tags, linked cels and the color
  mode). Older files still open; older versions of Raster can't open version 4
  files.
- Palette changes are now undoable and mark the document as changed.
- New transparency background: a light checker with faint bands in the logo's
  colors. Each square now covers whole sprite pixels, so zooming in never
  shows several squares inside one pixel.

## [0.2.0] - 2026-10-19

### Changed

- Raster is now a Windows desktop app. Download the installer (or the
  portable `.exe`) from GitHub Releases.
- Open and save use native Windows dialogs. Ctrl+S saves straight back to the
  file you opened, and exports ask where to save.
- Double-clicking a `.raster` file opens it in Raster; opening another file
  while Raster runs reuses the same window.
- Raster remembers its window size and position, and warns before quitting
  with unsaved changes.

### Removed

- The browser version, GitHub Pages deployment and installing as a web app
  (PWA), including Help › Install Raster.

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
