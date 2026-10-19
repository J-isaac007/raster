<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg" />
    <img src="docs/logo-light.svg" alt="Raster" height="72" />
  </picture>
</h1>

<p align="center"><strong>A free, open source pixel art editor.</strong></p>

<p align="center">
  <a href="https://github.com/J-isaac007/raster/releases/latest"><strong>Download for Windows</strong></a> ·
  <a href="docs/install.md">Install guide</a>
</p>

Raster is a fast, focused desktop editor for sprites, icons and game art. It
works offline, needs no account, and keeps your work on your machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Features

- **Drawing tools**: pencil, eraser, shade, flood fill, line, rectangle,
  ellipse and color picker, with brush sizes from 1 to 32 px
- **Pixel art brushes**: pixel-perfect strokes, ordered dithering and
  palette-aware shading
- **Animation**: frames, timeline, onion skinning, per-frame timing and
  playback; export animated GIFs and sprite sheets with JSON frame data
- **Tiles**: tile mode for seamless textures, tile grid for tilesets, and a
  reference image overlay for tracing
- **Selection**: rectangle select, move, cut, copy and paste (including images
  from other apps)
- **Symmetry**: mirror strokes horizontally, vertically or both
- **Layers**: reorder, merge, rename, set opacity, hide and lock
- **Colors**: primary and secondary colors with alpha, hex entry, palette
  presets (PICO-8, Game Boy, grayscale), `.hex` and `.gpl` import/export,
  indexed color mode and palette swapping
- **Full undo/redo** for every change to the document
- **Files**: save and open `.raster` projects, import PNG and animated GIF,
  export PNG, GIF or sprite sheets at 1×–16× scale
- **Native desktop app**: Windows installer, `.raster` files open with a
  double-click, native open and save dialogs, works fully offline
- **Autosave**: a refresh or crash never loses your work
- **Keyboard first**: shortcuts for every tool and command (press `?`)

## Install

Raster is a desktop app for **Windows 10 and 11**.

1. Download `Raster-Setup-<version>.exe` from the
   [latest release](https://github.com/J-isaac007/raster/releases/latest).
2. Run it. If Windows says "Windows protected your PC", click
   **More info › Run anyway** (the installer isn't code-signed yet).
3. Open Raster from the Start menu.

There's also a portable `.exe` that runs without installing. The
[install guide](docs/install.md) covers updating, uninstalling, where your
data lives and troubleshooting.

## Development

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
git clone https://github.com/J-isaac007/raster.git
cd raster
npm install
npm run dev
```

`npm run dev` opens Raster in a desktop window with hot reload.

### Scripts

| Command           | What it does                                                 |
| ----------------- | ------------------------------------------------------------ |
| `npm run dev`     | Run the desktop app with hot reload                          |
| `npm run dev:web` | Run the UI in a browser tab instead (quick UI work)          |
| `npm start`       | Build and run the production app                             |
| `npm run dist`    | Build the Windows installer and portable `.exe` (`release/`) |
| `npm test`        | Run the unit tests                                           |
| `npm run lint`    | Lint with ESLint                                             |
| `npm run format`  | Format with Prettier                                         |

## Using Raster

| Action                        | Input                                   |
| ----------------------------- | --------------------------------------- |
| Draw with primary / secondary | Left / right click                      |
| Pick a color                  | `Alt` + click, or the picker (`I`)      |
| Straight line from last point | `Shift` + click (pencil, eraser)        |
| Snap lines and square shapes  | Hold `Shift` while dragging             |
| Pan                           | `Space` + drag, or middle mouse         |
| Zoom at cursor                | Mouse wheel                             |
| Tools                         | `M` `Q` `W` `B` `E` `G` `L` `U` `O` `I` |
| Move a selection              | Drag inside it (selection tools)        |
| Add to / subtract a selection | `Shift` / `Ctrl` (lasso, wand)          |
| Invert selection              | `Ctrl+Shift+I`                          |
| Cut / copy / paste            | `Ctrl+X` / `Ctrl+C` / `Ctrl+V`          |
| Select all / deselect         | `Ctrl+A` / `Ctrl+D`                     |
| Play / pause animation        | `Enter`                                 |
| Previous / next frame         | `←` / `→`                               |
| New / duplicate frame         | `Alt+N` / `Alt+D`                       |
| Duplicate as linked frame     | `Shift+Alt+D`                           |
| New tag (named loop)          | `Alt+T`                                 |
| Onion skin                    | `Shift+O`                               |
| Tile mode / tile grid         | `Shift+T` / `Shift+G`                   |
| Swap colors                   | `X`                                     |
| Swap a palette color          | Double-click it                         |
| Indexed color mode            | `Shift+I`                               |
| Brush size                    | `[` and `]`                             |
| Undo / redo                   | `Ctrl+Z` / `Ctrl+Shift+Z`               |
| All shortcuts                 | `?`                                     |

On macOS, use `⌘` in place of `Ctrl`.

## Roadmap

Raster is young. Planned next, roughly in order:

- [x] Rectangle selection with move and copy/paste
- [x] Animation: frames, timeline, onion skinning, playback
- [x] GIF and sprite sheet export
- [x] Pixel-perfect strokes, dithering and shading
- [x] Tile mode, tile grid and reference images
- [x] Windows desktop app
- [x] Lasso and magic wand selection
- [x] Animation tags (named loops) and linked cels
- [x] Indexed color mode and palette swapping
- [ ] Custom brushes from selections
- [ ] Code-signed installer and automatic updates
- [ ] macOS and Linux builds

Ideas and votes are welcome in the issue tracker.

## Contributing

Contributions of all sizes are welcome: bug reports, docs, features and tests.
Read [CONTRIBUTING.md](CONTRIBUTING.md) to get set up and learn how the code
is organized. Everyone taking part agrees to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

Raster is released under the [MIT License](LICENSE). Art you make with Raster
is yours.
