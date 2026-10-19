import { FormatError } from '../core/format';
import { formatHexPalette, parsePalette } from '../core/palette';
import type { Editor, EditorState } from './editor';
import {
  baseName,
  decodeImage,
  downloadBlob,
  forgetFileHandle,
  imageFileToSprite,
  openProjectFile,
  pickFile,
  readClipboardImage,
  saveProject,
  writeClipboardImage,
} from './io';
import { TOOLS } from './tools';

export type DialogId = 'new' | 'export' | 'canvasSize' | 'grid' | 'shortcuts' | 'install' | 'about';

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

  const project = () => ({ sprite: editor.sprite, palette: editor.getState().palette });

  const save = async (saveAs: boolean) => {
    try {
      const name = await saveProject(project(), editor.getState().fileName, saveAs);
      if (name) {
        editor.markSaved(baseName(name));
        editor.notify(`Saved ${name}`);
      }
    } catch (e) {
      fail(e);
    }
  };

  const confirmDiscard = () =>
    !editor.getState().dirty || window.confirm('Discard unsaved changes?');

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
        if (!confirmDiscard()) return;
        const file = await pickFile('.raster,application/json');
        if (!file) return;
        try {
          const { sprite, palette } = await openProjectFile(file);
          editor.load(sprite, { palette, fileName: baseName(file.name) });
        } catch (e) {
          fail(e);
        }
      },
    },
    {
      id: 'file.import',
      label: 'Import Image…',
      keys: ['mod+i'],
      run: async () => {
        if (!confirmDiscard()) return;
        const file = await pickFile('image/png,image/gif,image/webp,image/jpeg,image/bmp');
        if (!file) return;
        try {
          forgetFileHandle();
          editor.load(await imageFileToSprite(file), {
            fileName: baseName(file.name),
            dirty: true,
          });
        } catch (e) {
          fail(e);
        }
      },
    },
    { id: 'file.save', label: 'Save', keys: ['mod+s'], run: () => save(false) },
    { id: 'file.saveAs', label: 'Save As…', keys: ['mod+shift+s'], run: () => save(true) },
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
      id: 'sprite.size',
      label: 'Canvas Size…',
      keys: ['mod+alt+c'],
      run: () => openDialog('canvasSize'),
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
    {
      id: 'layer.flipH',
      label: 'Flip Layer Horizontal',
      keys: ['shift+h'],
      run: () => editor.flip('horizontal', 'layer'),
    },
    {
      id: 'layer.flipV',
      label: 'Flip Layer Vertical',
      keys: ['shift+v'],
      run: () => editor.flip('vertical', 'layer'),
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
      id: 'help.install',
      label: 'Install Raster…',
      run: () => openDialog('install'),
    },
    {
      id: 'help.shortcuts',
      label: 'Keyboard Shortcuts',
      keys: ['?', 'shift+?'],
      run: () => openDialog('shortcuts'),
    },
    { id: 'help.about', label: 'About Raster', run: () => openDialog('about') },

    ...TOOLS.map((t) => ({
      id: `tool.${t.id}`,
      label: t.label,
      keys: [t.shortcut.toLowerCase()],
      run: () => editor.setTool(t.id),
    })),
  ];
}
