<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg" />
    <img src="docs/logo-light.svg" alt="Raster" height="72" />
  </picture>
</h1>

<p align="center"><strong>A free, open source pixel art editor.</strong></p>

<p align="center">
  <a href="https://j-isaac007.github.io/raster/"><strong>Open Raster</strong></a> ·
  <a href="docs/install.md">Install</a> ·
  <a href="https://github.com/J-isaac007/raster/releases">Releases</a>
</p>

Raster is a fast, focused editor for sprites, icons and game art. It runs in
any modern browser, needs no account, and keeps your work on your machine.

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
  presets (PICO-8, Game Boy, grayscale), `.hex` and `.gpl` import/export
- **Full undo/redo** for every change to the document
- **Files**: save and open `.raster` projects, import PNG and animated GIF,
  export PNG, GIF or sprite sheets at 1×–16× scale
- **Installable**: works offline as an app and opens `.raster` files from your
  desktop; drop files onto the window to open them
- **Autosave**: a refresh or crash never loses your work
- **Keyboard first**: shortcuts for every tool and command (press `?`)

## Install

Raster runs in your browser at **<https://j-isaac007.github.io/raster/>**, with
nothing to download. Install it from there to get its own window and icon,
offline use and `.raster` file opening:

| Device                          | How                                                    |
| ------------------------------- | ------------------------------------------------------ |
| Windows, macOS, Linux, ChromeOS | Chrome or Edge: install icon in the address bar        |
| Mac with Safari                 | File › Add to Dock                                     |
| Android                         | Chrome: ⋮ › Add to home screen › Install (no APK file) |
| iPhone, iPad                    | Safari: Share › Add to Home Screen                     |

Step-by-step instructions, updating, uninstalling and self-hosting are in the
[install guide](docs/install.md). In the app, **Help › Install Raster…** shows
the steps for your device.

## Development

Raster needs [Node.js](https://nodejs.org/) 20 or newer.

```bash
git clone <your fork or this repo's URL> raster
cd raster
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).

### Scripts

| Command           | What it does                         |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server with hot reload |
| `npm run build`   | Typecheck and build to `dist/`       |
| `npm run preview` | Serve the production build locally   |
| `npm test`        | Run the unit tests                   |
| `npm run lint`    | Lint with ESLint                     |
| `npm run format`  | Format with Prettier                 |

The production build is a static site. Host `dist/` anywhere: GitHub Pages,
Netlify, or any web server. It also works from a subfolder.

## Using Raster

| Action                        | Input                              |
| ----------------------------- | ---------------------------------- |
| Draw with primary / secondary | Left / right click                 |
| Pick a color                  | `Alt` + click, or the picker (`I`) |
| Straight line from last point | `Shift` + click (pencil, eraser)   |
| Snap lines and square shapes  | Hold `Shift` while dragging        |
| Pan                           | `Space` + drag, or middle mouse    |
| Zoom at cursor                | Mouse wheel                        |
| Tools                         | `M` `B` `E` `G` `L` `U` `O` `I`    |
| Move a selection              | Drag inside it (select tool)       |
| Cut / copy / paste            | `Ctrl+X` / `Ctrl+C` / `Ctrl+V`     |
| Select all / deselect         | `Ctrl+A` / `Ctrl+D`                |
| Play / pause animation        | `Enter`                            |
| Previous / next frame         | `←` / `→`                          |
| New / duplicate frame         | `Alt+N` / `Alt+D`                  |
| Onion skin                    | `Shift+O`                          |
| Tile mode / tile grid         | `Shift+T` / `Shift+G`              |
| Swap colors                   | `X`                                |
| Brush size                    | `[` and `]`                        |
| Undo / redo                   | `Ctrl+Z` / `Ctrl+Shift+Z`          |
| All shortcuts                 | `?`                                |

On macOS, use `⌘` in place of `Ctrl`.

## Roadmap

Raster is young. Planned next, roughly in order:

- [x] Rectangle selection with move and copy/paste
- [x] Animation: frames, timeline, onion skinning, playback
- [x] GIF and sprite sheet export
- [x] Pixel-perfect strokes, dithering and shading
- [x] Tile mode, tile grid and reference images
- [x] Installable PWA with offline support
- [ ] Lasso and magic wand selection
- [ ] Animation tags (named loops) and linked cels
- [ ] Indexed color mode and palette swapping
- [ ] Custom brushes from selections
- [ ] Desktop builds (Tauri)

Ideas and votes are welcome in the issue tracker.

## Contributing

Contributions of all sizes are welcome: bug reports, docs, features and tests.
Read [CONTRIBUTING.md](CONTRIBUTING.md) to get set up and learn how the code
is organized. Everyone taking part agrees to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

Raster is released under the [MIT License](LICENSE). Art you make with Raster
is yours.
