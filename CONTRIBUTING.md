# Contributing to Raster

Thanks for helping. This guide covers setup, how the code is laid out, and
what we look for in a pull request.

## Setup

```bash
npm install
npm run dev     # opens the desktop app with hot reload
npm test        # unit tests
```

Page changes reload in place; main process and preload changes restart the
app.

Before you open a pull request, make sure these pass:

```bash
npm run typecheck
npm run lint
npm test
npm run format:check
```

CI runs the same checks on every push and pull request.

## How the code is organized

[docs/architecture.md](docs/architecture.md) explains the processes, the
layers and what each may import, the IPC contract and how data flows. The
short version:

```
src/
  main/       Electron main process (Node)
    index.ts     Lifecycle: single instance, startup, quit
    window.ts    The window: saved size, navigation guards, quit warning
    files.ts     Open/save dialogs, trusted paths, files from Explorer
    updater.ts   Automatic updates from GitHub Releases (installed build only)
    store.ts     Preferences and recent files, in settings.json in user data
    ipc.ts       Typed handle/on/emit over the shared channel list
  preload/    The small `window.raster` API the page is allowed to use
  shared/     Used by every process: the IPC channels, RasterApi, and the
              Settings type with its validation (settings.ts)
  renderer/   The page
    index.html
    src/
      main.tsx   Bootstrap: load settings, restore autosave or show the welcome
                 screen, wire files and updates, render
      core/      Pure engine, see below
      editor/    The document store, see below
      platform/  I/O adapters
        desktop.ts   The `window.raster` bridge and file-type helpers
        files.ts     Open and save dialogs, project saving (Ctrl+S overwrites)
        image.ts     PNG encode/decode, importing images and animated GIFs
        clipboard.ts Copying and pasting images on the system clipboard
        settings.ts  The page's copy of the preferences (read sync, saved via main)
        recent.ts    The recent-files list
      app/       Wiring across layers
        commands.ts  Every menu command and keyboard shortcut
        openFile.ts  Opening dropped files and files from Explorer
        autosave.ts  localStorage autosave
        updates.ts   Update status, startup check and messages
        preferences.ts Keeps the editor in step with preferences
        commandSearch.ts Fuzzy matching for the command palette
      ui/        React components
        App.tsx         Layout and dialogs
        editorContext.ts React bindings (useEditor, useEditorState)
        components/     Shared primitives: Button, IconButton, Chip, TextInput, Select,
                        Checkbox, Slider, Swatch, PanelSection, Kbd, TooltipLayer
        canvas/         The drawing surface (renders outside React for speed)
        chrome/         Menu bar, toolbar, tool options, status bar, logo
        panels/         Color, palette, layers, reference, timeline
        dialogs/        One file per dialog, plus the shared Dialog shell
        screens/        Welcome screen and command palette
        theme.ts        Accent colors chosen in Preferences
      styles/    tokens.css (design tokens), components.css, then one stylesheet
                 per area of the screen, joined by index.css
      assets/    The logo's pixel grid
```

The pure engine and the store, in more detail:

```
core/     Pure TypeScript. No DOM, no React. Fully unit tested.
    color.ts     Packed RGBA colors, hex parsing, alpha blending
    sprite.ts    Sprite and layer model, compositing, flip, resize
    raster.ts    Drawing primitives: line, rect, ellipse, brush, flood fill
    mask.ts      Selection masks: lasso, magic wand, add/subtract, outlines
    tags.ts      Animation tags (named frame ranges) and tag-aware playback
    history.ts   Undo/redo stack and sparse pixel patches
    palette.ts   Palette presets, .hex/.gpl parsing, nearest color, remapping
    format.ts    The .raster project file format
    brush.ts     Dither patterns, pixel-perfect filter, shading
    gif.ts       GIF encoder (gifDecode.ts decodes, quantize.ts reduces colors)
    sheet.ts     Sprite sheet layout and JSON metadata
    transform.ts Quarter turns, flips, nearest scaling, RotSprite, trim bounds
editor/   The document store. No DOM, no React.
    editor.ts    The Editor: one store for document, history and UI state.
                 Delegates to the modules below, which see it via core.ts.
    state.ts     EditorState and other editor types, initial state
    core.ts      EditorCore: the store/history slice the modules use
    strokes.ts   Pixel edits from tools (dab, fill, shade), one undo step each
    selection.ts Selection, floating pixels, copy/cut/paste
    layers.ts    Layer stack: add, delete, reorder, merge, flip, properties
    frames.ts    Animation frames, linked cels, tags, durations, playback
    palette.ts   Palette changes, palette swaps and indexed color mode
    view.ts      Viewport, zoom and pan, tile wrapping, reference image
    geometry.ts  Whole-sprite reshapes: canvas size, scale, rotate, crop, trim
    tools.ts     Tool behaviors (pointer down/move/up → editor calls)
    testing.ts   Shared helpers for the *.test.ts files beside it
```

The page runs sandboxed with no Node access. Anything that touches the
file system goes through `window.raster` (see `src/shared/api.ts`), and the
main process only writes to files the user picked or opened.

Layers import each other by alias (`@core/color`, `@editor/editor`, …) and
only in the allowed direction; `npm run lint` fails otherwise. Inside a
layer, use relative imports.

### Key ideas

- **Colors are `number`s.** A color is a 32-bit RGBA value whose byte order
  matches `ImageData`, so layer buffers (`Uint32Array`) can be blitted directly.
- **The editor is the single source of truth.** UI reads immutable
  `EditorState` snapshots through `useEditorState(selector)` and re-renders
  only when its slice changes. Pixel data lives in `editor.sprite` and is
  mutated in place; `state.revision` bumps when it changes.
- **Every document change is undoable.** Pixel edits go through
  `beginStroke` → `dab`/`fill` → `endStroke`, which stores a sparse diff.
  Structural changes push a `Command` with `undo`/`redo`.
- **Strokes paint against a snapshot.** Each dab blends with the layer as it
  was when the stroke began, so overlapping dabs never stack alpha and shape
  tools can redraw their preview freely.
- **Layers hold one cel per frame.** `layer.cels[i]` is frame `i`'s pixels and
  `layer.pixels` always points at the current frame's cel, so tools never
  deal with frames. Undo commands keep a reference to the exact cel they
  changed and record the frame, so undo jumps back to it. Linked cels are
  frames whose entries are the same buffer; code that rebuilds cels uses
  `mapCels` so links survive.
- **Selections clip strokes and float when moved.** Strokes only touch pixels
  inside `state.selection`, a rectangle with an optional mask for lasso and
  magic wand shapes. Moving or pasting lifts pixels into a floating
  buffer stamped onto the layer; `settle()` commits it as one undo step and
  runs before any other document change.

### Adding a tool

1. Add its id to `ToolId` in `src/renderer/src/editor/state.ts`.
2. Implement it in `src/renderer/src/editor/tools.ts` and add it to `TOOLS`.
3. Give it an icon in `src/renderer/src/ui/chrome/Toolbar.tsx`.
4. Add tests next to the editor module it uses, e.g.
   `src/renderer/src/editor/strokes.test.ts`.

### Adding a command

Add an entry to `createActions` in `src/renderer/src/app/commands.ts`. Give it
`keys` for a shortcut, then list its id in a menu in
`src/renderer/src/ui/chrome/MenuBar.tsx`. The shortcuts dialog picks it up
automatically.

### Adding a call to the main process

Declare the channel in `src/shared/ipc.ts`, add the method to `RasterApi` in
`src/shared/api.ts`, implement it in `src/preload/index.ts` and handle it in
`src/main/`. The typecheck catches any mismatch between them. See
[the IPC contract](docs/architecture.md#the-ipc-contract).

### Changing the logo

The mark lives in `src/renderer/src/assets/brand/logo.json` as a pixel grid. The app reads it
directly; after editing it, run `node scripts/generate-icons.mjs` to rebuild
the favicon, app icons and README logos.

## Pull requests

- Keep each pull request to one change. Small is easier to review.
- Add or update tests for logic in `core/` and `editor/`.
- Update `CHANGELOG.md` under **Unreleased** for user-facing changes.
- Describe what changed and why. Add a screenshot or GIF for UI changes.
- Changes to the `.raster` format must bump its version and keep reading old
  files. See [docs/file-format.md](docs/file-format.md).

## Versioning and releases

Raster follows [Semantic Versioning](https://semver.org/). Before 1.0, minor
versions may include breaking changes; patch versions are fixes only. The
`.raster` file format has its own version number (see
[docs/file-format.md](docs/file-format.md)), which changes only when the file
layout does.

To cut a release, make sure `CHANGELOG.md` has notes under **Unreleased**,
then run one of:

```bash
npm run release -- patch   # 0.1.0 → 0.1.1
npm run release -- minor   # 0.1.0 → 0.2.0
npm run release -- major   # 0.1.0 → 1.0.0
```

The script bumps `package.json` and the lockfile and dates the changelog
section. It doesn't commit or tag; it prints the git commands to run once
you've reviewed the changes. The version shows in Help › About.

### Where builds go

Pushing a tag like `v0.2.0` runs `.github/workflows/release.yml` on Windows:
it builds `Raster-Setup-<version>.exe` and `Raster-<version>-portable.exe` and
publishes them as a GitHub Release with that version's changelog notes. The
tag must match `package.json`. How users install them is in
[docs/install.md](docs/install.md).

The release also carries `latest.yml` and the installer's `.blockmap`:
installed copies read them to find and verify updates, so don't remove them.

To build locally, run `npm run dist`; the files land in `release/`.

## Reporting bugs

Open an issue with steps to reproduce, what you expected, what happened, and
your Windows version and Raster version. A `.raster` file that shows the problem helps a lot.

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
