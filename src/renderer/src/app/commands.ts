import { FormatError } from '@core/format';
import { formatHexPalette, parsePalette } from '@core/palette';
import type { Editor, EditorState } from '@editor/editor';
import { readClipboardImage, writeClipboardImage } from '@platform/clipboard';
import { baseName, downloadBlob, pickFile, saveProject } from '@platform/files';
import { TOOLS } from '@editor/tools';
import { decodeImage } from '@platform/image';
import { clearRecent } from '@platform/recent';
import { openAnyFile } from './openFile';
import { checkForUpdates } from './updates';

export type DialogId =
  | 'new'
  | 'export'
  | 'canvasSize'
  | 'spriteSize'
  | 'transform'
  | 'grid'
  | 'shortcuts'
  | 'about'
  | 'tag'
  | 'paletteColor'
  | 'preferences'
  | 'commands'
  /** Not a dialog: shows the welcome screen in place of the editor. */
  | 'welcome';

export interface Action {
  id: string;
  label: string;
  /** Key combos like `mod+shift+z`; `mod` is Ctrl, or Cmd on macOS. */
  keys?: string[];
  run(): void;
  enabled?(s: EditorState): boolean;
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);

/** Turns `mod+shift+z` into `Ctrl+Shift+Z` (or `⌘⇧Z` on macOS). */
export function formatKeys(combo: string): string {
  const names: Record<string, string> = isMac
    ? { mod: '⌘', shift: '⇧', alt: '⌥' }
    : { mod: 'Ctrl', shift: 'Shift', alt: 'Alt' };
  const parts = combo.split('+').map((p) => names[p] ?? (p.length === 1 ? p.toUpperCase() : p));
  return parts.join(isMac ? '' : '+');
}

/** Normalizes a keyboard event into the same form as `Action.keys`. */
export function eventCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('mod');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  let key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // Shifted digits/symbols vary by layout; fall back to the physical key.
  if (e.shiftKey && /^Digit\d$/.test(e.code)) key = e.code.slice(5);
  if (key === '+') key = '=';
  parts.push(key);
  return parts.join('+');
}

/**
 * Pastes an image from the system clipboard (from a paste event's data, or
 * the async clipboard API), falling back to pixels copied inside Raster.
 */
export async function pasteClipboard(editor: Editor, data?: DataTransfer | null): Promise<void> {
  try {
    editor.paste((await readClipboardImage(data)) ?? editor.clipboard);
  } catch (e) {
    editor.notify(e instanceof RangeError ? e.message : 'Could not paste that image');
  }
}

export function createActions(editor: Editor, openDialog: (id: DialogId) => void): Action[] {
  const fail = (e: unknown) =>
    editor.notify(
      e instanceof FormatError || e instanceof RangeError ? e.message : 'Something went wrong',
    );

  const save = async (saveAs: boolean) => {
    try {
      const name = await saveProject(editor.project, editor.getState().fileName, saveAs);
      if (name) {
        editor.markSaved(baseName(name));
        editor.notify(`Saved ${name}`);
      }
    } catch (e) {
      fail(e);
    }
  };

  const hasLayerBelow = (s: EditorState) => s.layers.findIndex((l) => l.id === s.activeLayerId) > 0;
  const hasSelection = (s: EditorState) => s.selection !== null;

  return [
    {
      id: 'file.new',
      label: 'New Sprite…',
      keys: ['mod+alt+n'],
      run: () => openDialog('new'),
    },
    {
      id: 'file.open',
      label: 'Open…',
      keys: ['mod+o'],
      run: async () => {
        const file = await pickFile('.raster,application/json');
        if (file) await openAnyFile(editor, file);
      },
    },
    {
      id: 'file.import',
      label: 'Import Image…',
      keys: ['mod+i'],
      run: async () => {
        const file = await pickFile('image/png,image/gif,image/webp,image/jpeg,image/bmp');
        if (file) await openAnyFile(editor, file);
      },
    },
    { id: 'file.save', label: 'Save', keys: ['mod+s'], run: () => save(false) },
    { id: 'file.saveAs', label: 'Save As…', keys: ['mod+shift+s'], run: () => save(true) },
    {
      id: 'file.preferences',
      label: 'Preferences…',
      keys: ['mod+,'],
      run: () => openDialog('preferences'),
    },
    { id: 'file.clearRecent', label: 'Clear Recent Files', run: () => clearRecent() },
    {
      id: 'file.export',
      label: 'Export PNG…',
      keys: ['mod+shift+e'],
      run: () => openDialog('export'),
    },

    {
      id: 'edit.undo',
      label: 'Undo',
      keys: ['mod+z'],
      run: () => editor.undo(),
      enabled: (s) => !!s.undoLabel,
    },
    {
      id: 'edit.redo',
      label: 'Redo',
      keys: ['mod+shift+z', 'mod+y'],
      run: () => editor.redo(),
      enabled: (s) => !!s.redoLabel,
    },
    {
      id: 'edit.cut',
      label: 'Cut',
      keys: ['mod+x'],
      run: () => {
        const pixels = editor.cut();
        if (pixels) void writeClipboardImage(pixels);
      },
      enabled: hasSelection,
    },
    {
      id: 'edit.copy',
      label: 'Copy',
      keys: ['mod+c'],
      run: () => {
        const pixels = editor.copy();
        if (pixels) void writeClipboardImage(pixels);
      },
      enabled: hasSelection,
    },
    // Ctrl+V itself is handled by the window `paste` event (see App), which
    // can read images without a permission prompt.
    { id: 'edit.paste', label: 'Paste', keys: ['mod+v'], run: () => pasteClipboard(editor) },
    {
      id: 'edit.delete',
      label: 'Delete',
      keys: ['Delete', 'Backspace'],
      run: () => editor.deleteSelection(),
    },
    { id: 'edit.selectAll', label: 'Select All', keys: ['mod+a'], run: () => editor.selectAll() },
    {
      id: 'edit.deselect',
      label: 'Deselect',
      keys: ['mod+d'],
      run: () => editor.deselect(),
      enabled: hasSelection,
    },
    {
      id: 'edit.invertSelection',
      label: 'Invert Selection',
      keys: ['mod+shift+i'],
      run: () => editor.invertSelection(),
    },
    {
      id: 'edit.newBrush',
      label: 'New Brush from Selection',
      keys: ['mod+b'],
      run: () => editor.brushFromSelection(),
      enabled: hasSelection,
    },
    {
      id: 'edit.clearBrush',
      label: 'Use Square Brush',
      keys: ['mod+shift+b'],
      run: () => editor.clearCustomBrush(),
      enabled: (s) => s.customBrush !== null,
    },
    // Transforms act on the selection, or the whole layer when nothing is selected.
    {
      id: 'edit.flipH',
      label: 'Flip Horizontal',
      keys: ['shift+h'],
      run: () => editor.flipSelection('horizontal'),
    },
    {
      id: 'edit.flipV',
      label: 'Flip Vertical',
      keys: ['shift+v'],
      run: () => editor.flipSelection('vertical'),
    },
    { id: 'edit.rotateCW', label: 'Rotate 90° CW', run: () => editor.rotateSelection(1) },
    { id: 'edit.rotateCCW', label: 'Rotate 90° CCW', run: () => editor.rotateSelection(-1) },
    { id: 'edit.rotate180', label: 'Rotate 180°', run: () => editor.rotateSelection(2) },
    {
      id: 'edit.transform',
      label: 'Transform…',
      keys: ['mod+t'],
      run: () => openDialog('transform'),
    },
    { id: 'edit.clear', label: 'Clear Layer', run: () => editor.clearLayer() },
    { id: 'edit.swap', label: 'Swap Colors', keys: ['x'], run: () => editor.swapColors() },
    {
      id: 'edit.brushUp',
      label: 'Bigger Brush',
      keys: [']'],
      run: () => editor.setBrushSize(editor.getState().brushSize + 1),
    },
    {
      id: 'edit.brushDown',
      label: 'Smaller Brush',
      keys: ['['],
      run: () => editor.setBrushSize(editor.getState().brushSize - 1),
    },

    {
      id: 'sprite.scale',
      label: 'Sprite Size…',
      keys: ['mod+alt+i'],
      run: () => openDialog('spriteSize'),
    },
    {
      id: 'sprite.size',
      label: 'Canvas Size…',
      keys: ['mod+alt+c'],
      run: () => openDialog('canvasSize'),
    },
    {
      id: 'sprite.rotateCW',
      label: 'Rotate Sprite 90° CW',
      run: () => editor.rotateSprite(1),
    },
    {
      id: 'sprite.rotateCCW',
      label: 'Rotate Sprite 90° CCW',
      run: () => editor.rotateSprite(-1),
    },
    {
      id: 'sprite.rotate180',
      label: 'Rotate Sprite 180°',
      run: () => editor.rotateSprite(2),
    },
    {
      id: 'sprite.flipH',
      label: 'Flip Sprite Horizontal',
      run: () => editor.flip('horizontal', 'sprite'),
    },
    {
      id: 'sprite.flipV',
      label: 'Flip Sprite Vertical',
      run: () => editor.flip('vertical', 'sprite'),
    },
    {
      id: 'sprite.crop',
      label: 'Crop to Selection',
      run: () => editor.cropToSelection(),
      enabled: hasSelection,
    },
    { id: 'sprite.trim', label: 'Trim Empty Edges', run: () => editor.trim() },

    { id: 'layer.new', label: 'New Layer', keys: ['shift+n'], run: () => editor.addLayer() },
    {
      id: 'layer.duplicate',
      label: 'Duplicate Layer',
      keys: ['shift+d'],
      run: () => editor.duplicateLayer(),
    },
    {
      id: 'layer.delete',
      label: 'Delete Layer',
      run: () => editor.deleteLayer(),
      enabled: (s) => s.layers.length > 1,
    },
    {
      id: 'layer.mergeDown',
      label: 'Merge Down',
      keys: ['mod+e'],
      run: () => editor.mergeDown(),
      enabled: hasLayerBelow,
    },

    { id: 'view.zoomIn', label: 'Zoom In', keys: ['=', 'mod+='], run: () => editor.zoomStep(1) },
    { id: 'view.zoomOut', label: 'Zoom Out', keys: ['-', 'mod+-'], run: () => editor.zoomStep(-1) },
    { id: 'view.fit', label: 'Zoom to Fit', keys: ['0', 'mod+0'], run: () => editor.zoomToFit() },
    { id: 'view.actual', label: 'Actual Size', keys: ['1'], run: () => editor.setZoom(1) },
    {
      id: 'view.grid',
      label: 'Toggle Pixel Grid',
      keys: ["mod+'"],
      run: () => editor.setOption({ showGrid: !editor.getState().showGrid }),
    },
    {
      id: 'view.tileGrid',
      label: 'Toggle Tile Grid',
      keys: ['shift+g'],
      run: () => editor.setOption({ showTileGrid: !editor.getState().showTileGrid }),
    },
    {
      id: 'view.tileMode',
      label: 'Toggle Tile Mode',
      keys: ['shift+t'],
      run: () =>
        editor.setOption({ tileMode: editor.getState().tileMode === 'off' ? 'both' : 'off' }),
    },
    { id: 'view.gridSettings', label: 'Grid & Tiles…', run: () => openDialog('grid') },
    {
      id: 'view.reference',
      label: 'Load Reference Image…',
      run: async () => {
        const file = await pickFile('image/*');
        if (!file) return;
        try {
          editor.setReference(await decodeImage(file));
        } catch (e) {
          fail(e);
        }
      },
    },
    {
      id: 'view.referenceToggle',
      label: 'Toggle Reference Image',
      keys: ['shift+r'],
      run: () => editor.updateReference({ visible: !editor.getState().reference?.visible }),
      enabled: (s) => s.reference !== null,
    },
    {
      id: 'view.mirrorX',
      label: 'Toggle Horizontal Symmetry',
      keys: ['shift+m'],
      run: () => editor.setOption({ mirrorX: !editor.getState().mirrorX }),
    },

    { id: 'frame.new', label: 'New Frame', keys: ['alt+n'], run: () => editor.addFrame() },
    {
      id: 'frame.duplicate',
      label: 'Duplicate Frame',
      keys: ['alt+d'],
      run: () => editor.duplicateFrame(),
    },
    {
      id: 'frame.duplicateLinked',
      label: 'Duplicate Linked Frame',
      keys: ['shift+alt+d'],
      run: () => editor.duplicateLinkedFrame(),
    },
    {
      id: 'frame.unlink',
      label: 'Unlink Cel',
      run: () => editor.unlinkCel(),
    },
    {
      id: 'frame.newTag',
      label: 'New Tag…',
      keys: ['alt+t'],
      run: () => openDialog('tag'),
    },
    {
      id: 'frame.delete',
      label: 'Delete Frame',
      keys: ['alt+Delete', 'alt+Backspace'],
      run: () => editor.deleteFrame(),
      enabled: (s) => s.frames.length > 1,
    },
    {
      id: 'frame.prev',
      label: 'Previous Frame',
      keys: ['ArrowLeft', ','],
      run: () => editor.prevFrame(),
      enabled: (s) => s.frames.length > 1,
    },
    {
      id: 'frame.next',
      label: 'Next Frame',
      keys: ['ArrowRight', '.'],
      run: () => editor.nextFrame(),
      enabled: (s) => s.frames.length > 1,
    },
    {
      id: 'frame.moveLeft',
      label: 'Move Frame Left',
      keys: ['alt+ArrowLeft'],
      run: () => editor.moveFrame(-1),
      enabled: (s) => s.frame > 0,
    },
    {
      id: 'frame.moveRight',
      label: 'Move Frame Right',
      keys: ['alt+ArrowRight'],
      run: () => editor.moveFrame(1),
      enabled: (s) => s.frame < s.frames.length - 1,
    },
    {
      id: 'frame.play',
      label: 'Play / Pause',
      keys: ['Enter'],
      run: () => editor.setPlaying(!editor.getState().playing),
      enabled: (s) => s.frames.length > 1,
    },
    {
      id: 'frame.onion',
      label: 'Toggle Onion Skin',
      keys: ['shift+o'],
      run: () => editor.setOnionSkin(!editor.getState().onionSkin),
    },

    {
      id: 'palette.editColor',
      label: 'Swap Palette Color…',
      run: () => openDialog('paletteColor'),
      enabled: (s) => s.palette.includes(s.primary),
    },
    {
      id: 'palette.indexed',
      label: 'Toggle Indexed Color',
      keys: ['shift+i'],
      run: () => editor.setIndexed(!editor.getState().indexed),
    },
    {
      id: 'palette.import',
      label: 'Load Palette…',
      run: async () => {
        const file = await pickFile('.hex,.gpl,.txt');
        if (!file) return;
        const colors = parsePalette(await file.text());
        if (colors.length) editor.setPalette(colors);
        else editor.notify('No colors found in that file');
      },
    },
    {
      id: 'palette.export',
      label: 'Save Palette…',
      run: () => {
        const text = formatHexPalette(editor.getState().palette);
        downloadBlob(new Blob([text], { type: 'text/plain' }), `${editor.getState().fileName}.hex`);
      },
    },

    {
      id: 'help.commands',
      label: 'Command Palette…',
      keys: ['mod+k', 'mod+shift+p'],
      run: () => openDialog('commands'),
    },
    { id: 'help.welcome', label: 'Welcome Screen', run: () => openDialog('welcome') },
    {
      id: 'help.shortcuts',
      label: 'Keyboard Shortcuts',
      keys: ['?', 'shift+?'],
      run: () => openDialog('shortcuts'),
    },
    { id: 'help.updates', label: 'Check for Updates…', run: () => checkForUpdates(editor) },
    { id: 'help.about', label: 'About Raster', run: () => openDialog('about') },

    ...TOOLS.map((t) => ({
      id: `tool.${t.id}`,
      label: t.label,
      keys: [t.shortcut.toLowerCase()],
      run: () => editor.setTool(t.id),
    })),
  ];
}
