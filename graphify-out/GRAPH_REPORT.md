# Graph Report - raster  (2026-10-19)

## Corpus Check
- Corpus is ~33,426 words - fits in a single context window. You may not need a graph.

## Summary
- 608 nodes · 1482 edges · 34 communities (22 shown, 12 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 114 edges (avg confidence: 0.85)
- Token cost: 242,718 input · 0 output

## Community Hubs (Navigation)
- Editor Store and Undo History
- UI Panels and Dialogs
- Color, Brushes and GIF
- Files, Format and Desktop I/O
- Repo Process and Releases
- Electron Main Process
- Raster Drawing Primitives
- Windows Installer Config
- Dev Dependencies
- TypeScript Config
- Package Metadata
- Icon and Logo Generator
- Editor State Types
- Sprite and Layer Model
- npm Scripts
- Tools and Tool Options
- Canvas Rendering
- Editor Tests
- ESLint Config
- Logo Dark Variant
- Logo Light Variant
- Desktop Bridge API
- Vite Build and CSP
- Repository Field
- Commands and Shortcuts
- Drawing Tools Docs
- Brush Concepts
- Node Engine Requirement
- Logo Pixel Grid
- Layers Feature
- Palette Features
- Symmetry Drawing
- Tiles and Reference Image

## God Nodes (most connected - your core abstractions)
1. `Editor` - 103 edges
2. `createActions()` - 50 edges
3. `useEditor()` - 30 edges
4. `useEditorState()` - 27 edges
5. `App()` - 23 edges
6. `rgba()` - 20 edges
7. `encodeGif()` - 17 edges
8. `compilerOptions` - 17 edges
9. `toHex()` - 16 edges
10. `ExportDialog()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Bug Report Issue Form` --semantically_similar_to--> `Contributing Guide`  [INFERRED] [semantically similar]
  .github/ISSUE_TEMPLATE/bug_report.yml → CONTRIBUTING.md
- `Raster Pixel Art Editor` --references--> `Raster-<version>-portable.exe`  [EXTRACTED]
  README.md → docs/install.md
- `Native Windows Desktop App` --conceptually_related_to--> `.raster File Association`  [INFERRED]
  README.md → docs/install.md
- `Autosave` --shares_data_with--> `Autosave and Settings in %APPDATA%\Raster`  [INFERRED]
  README.md → docs/install.md
- `npm Scripts (dev, dev:web, start, dist, test, lint, format)` --conceptually_related_to--> `CI Workflow (typecheck, lint, format, test, build)`  [INFERRED]
  README.md → .github/workflows/ci.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Release Pipeline (release script -> tag -> workflow -> installer/portable)** — contributing_release_script, changelog_changelog, _github_workflows_release_release_workflow, _github_workflows_release_tag_version_check, _github_workflows_release_extract_release_notes, docs_install_setup_installer, docs_install_portable_exe [EXTRACTED 1.00]
- **Pre-merge Quality Gates (typecheck, lint, format, test)** — contributing_contributing_guide, _github_workflows_ci_ci_workflow, _github_pull_request_template_pr_checklist, readme_npm_scripts [INFERRED 0.85]
- **Editor Core Architecture Ideas** — contributing_colors_as_numbers, contributing_editor_single_source_of_truth, contributing_undoable_changes, contributing_snapshot_strokes, contributing_cels_per_frame, contributing_floating_selection [EXTRACTED 1.00]

## Communities (34 total, 12 thin omitted)

### Community 0 - "Editor Store and Undo History"
Cohesion: 0.05
Nodes (10): applyPatch(), Command, diffPixels(), History, PixelPatch, createActions(), pasteClipboard(), clampDuration() (+2 more)

### Community 1 - "UI Panels and Dialogs"
Cohesion: 0.07
Nodes (59): lucide-react, react, FrameRect, layoutSheet(), packSheet(), Sheet, SheetLayout, sheetMetadata() (+51 more)

### Community 2 - "Color, Brushes and GIF"
Cohesion: 0.10
Nodes (42): vitest, adjustLightness(), BAYER4, DITHER_LEVELS, ditherHit(), fromHsl(), PixelPerfect, Point (+34 more)

### Community 3 - "Files, Format and Desktop I/O"
Cohesion: 0.07
Nodes (50): index.html App Shell (#root mount), react-dom, FILE_EXTENSION, FORMAT_VERSION, FormatError, fromBase64(), LayerJson, MAX_FRAMES (+42 more)

### Community 4 - "Repo Process and Releases"
Cohesion: 0.06
Nodes (34): Bug Report Issue Form, Issue Template Config (blank issues enabled), Feature Request Issue Form, Other Pixel Editors (Aseprite, Pixelorama, LibreSprite), Pull Request Checklist, CI Workflow (typecheck, lint, format, test, build), Extract Release Notes from CHANGELOG, Release Workflow (tag-triggered Windows build) (+26 more)

### Community 5 - "Electron Main Process"
Cohesion: 0.08
Nodes (22): { app, BrowserWindow, dialog, ipcMain, Menu, shell }, createWindow(), flushOpens(), fs, fsp, loadWindowState(), path, pendingOpens (+14 more)

### Community 6 - "Raster Drawing Primitives"
Cohesion: 0.15
Nodes (17): floodRegion(), getPixel(), inBounds(), intersectRect(), Plot, plotBrush(), plotEllipse(), plotLine() (+9 more)

### Community 7 - "Windows Installer Config"
Cohesion: 0.09
Nodes (23): build, appId, copyright, directories, fileAssociations, files, nsis, portable (+15 more)

### Community 8 - "Dev Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, electron, electron-builder, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+11 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 10 - "Package Metadata"
Cohesion: 0.12
Nodes (16): author, description, homepage, keywords, license, main, name, private (+8 more)

### Community 11 - "Icon and Logo Generator"
Cohesion: 0.19
Nodes (14): BG, chunk(), COLORS, crc32(), crcTable, GLYPHS, hexRgb(), lockup() (+6 more)

### Community 12 - "Editor State Types"
Cohesion: 0.17
Nodes (13): DEFAULT_PALETTE, Rect, Layer, showFrame(), Surface, EditorState, Floating, LayerInfo (+5 more)

### Community 13 - "Sprite and Layer Model"
Cohesion: 0.23
Nodes (13): cloneLayer(), copyRect(), createLayer(), createSprite(), flipPixels(), Frame, MAX_SPRITE_SIZE, mergeInto() (+5 more)

### Community 14 - "npm Scripts"
Cohesion: 0.14
Nodes (14): scripts, build, dev, dev:web, dist, dist:dir, format, format:check (+6 more)

### Community 15 - "Tools and Tool Options"
Cohesion: 0.18
Nodes (7): MAX_BRUSH, ToolId, Tool, BRUSH_TOOLS, DITHER_OPTIONS, DITHER_TOOLS, HINTS

### Community 16 - "Canvas Rendering"
Cohesion: 0.29
Nodes (8): rectContains(), composite(), compositeFrame(), CanvasView(), Gesture, makeChecker(), ONION_TINTS, tintInto()

### Community 17 - "Editor Tests"
Cohesion: 0.33
Nodes (5): at(), RED, setup(), TOOL_BY_ID, ToolEvent

### Community 18 - "ESLint Config"
Cohesion: 0.33
Nodes (5): @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, typescript-eslint

### Community 19 - "Logo Dark Variant"
Cohesion: 0.50
Nodes (4): Raster Logo (Dark Variant), Raster Brand Color Palette, Pixel-Art 'R' Icon Mark, Pixel 'Raster' Wordmark

### Community 20 - "Logo Light Variant"
Cohesion: 0.50
Nodes (4): Raster Logo (Light Variant), Raster Brand Color Palette, Pixel-Art R App Icon Mark, Raster Pixel Wordmark

### Community 23 - "Repository Field"
Cohesion: 0.67
Nodes (3): repository, type, url

## Knowledge Gaps
- **29 isolated node(s):** `@types/react`, `@types/react-dom`, `electron-builder`, `eslint`, `prettier` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 210 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Editor` connect `Editor Store and Undo History` to `UI Panels and Dialogs`, `Color, Brushes and GIF`, `Files, Format and Desktop I/O`, `Raster Drawing Primitives`, `Editor State Types`, `Tools and Tool Options`, `Canvas Rendering`, `Editor Tests`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Are the 35 inferred relationships involving `createActions()` (e.g. with `.addFrame()` and `.addLayer()`) actually correct?**
  _`createActions()` has 35 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/react`, `@types/react-dom`, `electron-builder` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Editor Store and Undo History` be split into smaller, more focused modules?**
  _Cohesion score 0.05464725643896976 - nodes in this community are weakly interconnected._
- **Why does `react` connect `UI Panels and Dialogs` to `Canvas Rendering`, `Color, Brushes and GIF`, `Package Metadata`, `Files, Format and Desktop I/O`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Should `UI Panels and Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Color, Brushes and GIF` to `Editor Store and Undo History`, `Raster Drawing Primitives`, `Package Metadata`, `Sprite and Layer Model`, `Editor Tests`, `Vite Build and CSP`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._