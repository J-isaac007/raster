# Contributing to Raster

Thanks for helping. This guide covers setup, how the code is laid out, and
what we look for in a pull request.

## Setup

```bash
npm install
npm run dev     # opens the desktop app with hot reload
npm test        # unit tests
```

`npm run dev:web` runs the UI in a browser tab instead, which is handy for
quick UI work; file dialogs fall back to browser downloads there.

Before you open a pull request, make sure these pass:

```bash
npm run typecheck
npm run lint
npm test
npm run format:check
```

CI runs the same checks on every push and pull request.

## How the code is organized

```
src/
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
  editor/   Application logic, still framework-free where possible.
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
    tools.ts     Tool behaviors (pointer down/move/up → editor calls)
    actions.ts   Every menu command and keyboard shortcut
    files.ts     Open and save dialogs, project saving (Ctrl+S overwrites)
    image.ts     PNG encode/decode, importing images and animated GIFs
    clipboard.ts Copying and pasting images on the system clipboard
    autosave.ts  localStorage autosave
    openFile.ts  Opening dropped files and files from Explorer
    desktop.ts   The bridge to the desktop shell (native dialogs, file paths)
    context.ts   React bindings (useEditor, useEditorState)
  ui/       React components.
    CanvasView.tsx  The drawing surface (renders outside React for speed)
electron/   The desktop shell.
  main.cjs     Window, native dialogs, reading and writing files
  preload.cjs  The small `window.raster` API the page is allowed to use
```

The page runs sandboxed with no Node access. Anything that touches the
file system goes through `window.raster` (see `src/editor/desktop.ts`), and the
main process only writes to files the user picked or opened.

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

1. Add its id to `ToolId` in `src/editor/state.ts`.
2. Implement it in `src/editor/tools.ts` and add it to `TOOLS`.
3. Give it an icon in `src/ui/Toolbar.tsx`.
4. Add tests in `src/editor/editor.test.ts`.

### Adding a command

Add an entry to `createActions` in `src/editor/actions.ts`. Give it `keys` for
a shortcut, then list its id in a menu in `src/ui/MenuBar.tsx`. The shortcuts
dialog picks it up automatically.

### Changing the logo

The mark lives in `src/brand/logo.json` as a pixel grid. The app reads it
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

To build locally, run `npm run dist`; the files land in `release/`.

## Reporting bugs

Open an issue with steps to reproduce, what you expected, what happened, and
your Windows version and Raster version. A `.raster` file that shows the problem helps a lot.

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
