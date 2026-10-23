# Architecture

Raster is an Electron app written in TypeScript. This page explains how the
code is split up, which parts may depend on which, and how data moves through
the app. For setup and conventions, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Processes

```
┌──────────────────────┐   IPC (src/shared/ipc.ts)   ┌──────────────────────────┐
│ main process (Node)  │ ◄─────────────────────────► │ preload (sandboxed)      │
│ src/main             │                             │ src/preload              │
│ window, dialogs,     │                             │ exposes window.raster    │
│ files, updates       │                             └────────────┬─────────────┘
└──────────────────────┘                                          │ contextBridge
                                                     ┌────────────▼─────────────┐
                                                     │ renderer (the page)      │
                                                     │ src/renderer             │
                                                     │ React UI + editor        │
                                                     └──────────────────────────┘
```

- **Main** (`src/main`) owns the window, native dialogs, the file system and
  the auto-updater. It runs one instance: a second launch hands its files to
  the first window and exits.
- **Preload** (`src/preload`) runs before the page with `contextIsolation`
  and `sandbox` on. It exposes one object, `window.raster` (`RasterApi` in
  `src/shared/api.ts`), and nothing else. It is built as CommonJS because
  sandboxed preload scripts can't be ES modules.
- **Renderer** (`src/renderer`) is the whole editor. It has no Node access
  and a strict Content Security Policy in production builds (see
  `electron.vite.config.ts`).
- **Shared** (`src/shared`) holds types only: the IPC contract and the
  `window.raster` API. All three import it; it imports nothing.

### Security rules

- The page can only overwrite files the user picked in a dialog or opened in
  this session (`trustedPaths` in `src/main/files.ts`). Any other save asks.
- IPC arguments come from the page, so main-process handlers treat them as
  untrusted (`Partial<…>` parameters in `src/main/ipc.ts` force the checks).
- The window never navigates: links open in the browser and new windows are
  denied (`src/main/window.ts`). DevTools only open in development.

## The IPC contract

Every channel is declared once in `src/shared/ipc.ts`, in three groups:

| Group            | Direction             | Main side  | Preload side         |
| ---------------- | --------------------- | ---------- | -------------------- |
| `InvokeChannels` | page → main, reply    | `handle()` | `ipcRenderer.invoke` |
| `SendChannels`   | page → main, no reply | `on()`     | `ipcRenderer.send`   |
| `EventChannels`  | main → page           | `emit()`   | `ipcRenderer.on`     |

`src/main/ipc.ts` and `src/preload/index.ts` are typed against these maps,
so a misspelled channel or a wrong payload fails the typecheck. To add a
call: declare the channel in `src/shared/ipc.ts`, add the method to
`RasterApi` in `src/shared/api.ts`, implement it in `src/preload/index.ts`,
and handle it in the main process.

## Renderer layers

```
src/renderer/src/
  core/       pure engine        imports nothing
  editor/     document store     imports core
  platform/   I/O adapters       imports core, shared
  app/        composition        imports core, editor, platform
  ui/         React components   imports anything in the renderer
  assets/     data files (the logo)
  styles/     CSS: design tokens, shared components, one file per area
  main.tsx    bootstrap
```

| Layer       | What lives there                                                                                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`     | Colors, sprites, drawing primitives, selections, history, palettes, transforms (RotSprite), the file format, GIF and sheet export. No DOM, no React.                                                                 |
| `editor/`   | The `Editor` store: document, undo history and UI state, split into modules (strokes, selection, layers, frames, palette, view, geometry) plus tool behaviors. No DOM.                                               |
| `platform/` | Things that touch the outside world: the `window.raster` bridge, file dialogs and project saving, image decoding, the clipboard.                                                                                     |
| `app/`      | Wiring that needs several layers: every menu command and shortcut (`commands.ts`), opening files, autosave, update checks.                                                                                           |
| `ui/`       | React. `editorContext.ts` connects components to the store; shared primitives live in `components/`; screens are grouped into `canvas/`, `chrome/` (menu bar, toolbar, status bar, toast), `panels/` and `dialogs/`. |

Each arrow is enforced by ESLint (`no-restricted-imports` in
`eslint.config.js`): a layer imports other layers by alias only (`@core/…`,
`@editor/…`, `@platform/…`, `@app/…`, `@ui/…`, `@assets/…`, `@shared/…`) and
only the ones it's allowed. Inside a layer, imports are relative. React is
only allowed in `ui/`. The aliases are defined in `electron.vite.config.ts`
and mirrored in `tsconfig.web.json`.

## Data flow

### Drawing, undo and rendering

1. `ui/canvas/CanvasView.tsx` turns pointer events into tool calls
   (`editor/tools.ts`), which call the editor: `beginStroke` → `dab`/`fill`
   → `endStroke`.
2. The stroke module edits the active layer's pixels in place and, at the end
   of the stroke, stores a sparse diff in the history (`core/history.ts`).
   Structural changes (layers, frames, resizes) push a `Command` with
   `undo`/`redo` instead.
3. The editor publishes a new immutable `EditorState` snapshot and bumps
   `state.revision`.
4. Components read slices with `useEditorState(selector)` and re-render only
   when their slice changes. The canvas redraws outside React, on the next
   animation frame after a revision change.

### Opening and saving

- **Open dialog:** `platform/files.ts` → `window.raster.openFile` →
  `file:open` → native dialog → the file's bytes come back and become a
  `File` → `app/openFile.ts` decides by extension (project, image, GIF).
- **Double-click in Explorer / second launch:** main queues the path,
  then sends `file:opened` once the page has called `onOpenFile` (the page
  says it's ready by subscribing).
- **Save:** `platform/files.ts` serializes the project (`core/format.ts`)
  and calls `saveFile` with the path it was opened from. Main overwrites
  it only if the path is trusted, otherwise it shows a save dialog.
- **Autosave:** `app/autosave.ts` keeps the current sprite in
  `localStorage` and restores it on start. The dirty flag goes to main
  (`doc:dirty`) for the quit warning.

### Updates

`src/main/updater.ts` wraps `electron-updater` for the installed build; the
portable exe and development runs report `unsupported`. The page asks for a
check at start (if enabled in Preferences) through `app/updates.ts`, and
main pushes every status change back on `update:status`. A downloaded update
installs on quit, or right away from the update badge.

### Preferences and recent files

`src/main/store.ts` keeps both in `settings.json` in the user-data folder,
written through a temp file. Every value read from disk or sent by the page
goes through `sanitizeSettings` / `sanitizeRecent` in `src/shared/settings.ts`.
The page loads the settings once before it renders (`platform/settings.ts`),
reads them synchronously after that, and saves changes in the background
(`settings:set`). Opening a sprite or saving a project adds it to the recent
list in the main process; `recent:open` only reads paths that are on that
list.

## Build and packaging

| File                          | Role                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| `electron.vite.config.ts`     | Builds main (ESM), preload (CommonJS) and the renderer into `out/`.    |
| `electron-builder.config.cjs` | Packages `out/` into the NSIS installer and portable exe (`release/`). |
| `vitest.config.ts`            | Unit tests (`*.test.ts` next to the code they test).                   |
| `tsconfig.node.json`          | Typecheck for main, preload, shared and the config files.              |
| `tsconfig.web.json`           | Typecheck for the renderer and shared.                                 |
| `build/`                      | Installer resources: app icon, installer notice.                       |
| `scripts/`                    | Icon generation and the release script.                                |

`npm run dev` starts the renderer dev server with hot reload and restarts
Electron when main or preload code changes. `npm run dist` typechecks,
builds and packages.

## UI design system

The interface is designed in the "Raster UI" Figma file and built from the
same parts in code:

- **Tokens.** `styles/tokens.css` holds every color, space, radius, size,
  type style and shadow, named after the Figma variables (`color/panel` is
  `--panel`, `space/md` is `--space-md`). Stylesheets use tokens, never raw
  values; change a token in Figma and in `tokens.css` together.
- **Components.** `ui/components/` has one React primitive per Figma
  component (Button, IconButton, Chip, TextInput, Select, Checkbox, Slider,
  Swatch, PanelSection, Kbd), styled in `styles/components.css`. Panels and
  dialogs are composed from them.
- **Inline styles** are only for values known at runtime: a swatch's color,
  a thumbnail's size, a tag's position on the timeline.
- **Tooltips** come from `TooltipLayer`: any element with `data-tooltip`
  (every IconButton) gets one, with its `data-shortcut`.
