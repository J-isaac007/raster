# Changelog

All notable changes to Raster are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
