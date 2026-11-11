import { FILE_EXTENSION, FormatError } from '@core/format';
import { clampSpriteSize } from '@core/sprite';
import type { PickedFile } from '@platform/desktop';
import { baseName, newFileRef, openProjectFile } from '@platform/files';
import { imageFileToSprite } from '@platform/image';
import { readRecentFile } from '@platform/recent';
import type { Documents } from './documents';
import { importPaletteFile, isPaletteFile } from './palettes';

/** Starts a blank sprite in a new tab (or the untouched untitled one). */
export function newSprite(docs: Documents, width: number, height: number): boolean {
  docs.open((editor) => editor.newSprite(clampSpriteSize(width), clampSpriteSize(height)));
  return true;
}

/** Opens a file from the recent list (File menu, welcome screen, command palette). */
export async function openRecent(docs: Documents, path: string, name: string): Promise<void> {
  const file = await readRecentFile(path);
  if (file) await openAnyFile(docs, file);
  else docs.active().editor.notify(`${name} was moved or deleted`);
}

/**
 * Opens a `.raster` project or an image in a tab of its own (or switches to
 * its tab if it's already open). Palette files are imported into My palettes
 * and applied to the active sprite instead.
 */
export async function openAnyFile(docs: Documents, file: PickedFile): Promise<void> {
  const notify = (message: string) => docs.active().editor.notify(message);
  if (isPaletteFile(file.name)) {
    await importPaletteFile(docs.active().editor, file, { apply: true });
    return;
  }
  const open = file.path ? docs.list().find((d) => d.file.path === file.path) : undefined;
  if (open) {
    docs.activate(open.id);
    return;
  }
  try {
    if (file.name.toLowerCase().endsWith(FILE_EXTENSION)) {
      const { project, ref } = await openProjectFile(file);
      const { sprite, palette, indexed, recentColors } = project;
      docs.open(
        (editor) =>
          editor.load(sprite, { palette, indexed, recentColors, fileName: baseName(file.name) }),
        ref,
      );
    } else if (file.type.startsWith('image/')) {
      const sprite = await imageFileToSprite(file);
      docs.open(
        (editor) => editor.load(sprite, { fileName: baseName(file.name), dirty: true }),
        newFileRef(),
      );
    } else {
      notify(`Can't open ${file.name}`);
    }
  } catch (e) {
    notify(
      e instanceof FormatError || e instanceof RangeError ? e.message : `Can't open ${file.name}`,
    );
  }
}

/** Lets files be dropped anywhere on the window to open them, each in its own tab. */
export function acceptDroppedFiles(docs: Documents): () => void {
  const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  };
  const onDrop = async (e: DragEvent) => {
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) await openAnyFile(docs, file);
  };
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('drop', onDrop);
  return () => {
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('drop', onDrop);
  };
}
