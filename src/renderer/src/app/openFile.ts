import { FILE_EXTENSION, FormatError } from '@core/format';
import type { Editor } from '@editor/editor';
import { clampSpriteSize } from '@core/sprite';
import { baseName, forgetFileHandle, openProjectFile } from '@platform/files';
import { imageFileToSprite } from '@platform/image';
import { readRecentFile } from '@platform/recent';

/** Starts a blank sprite, after confirming if there are unsaved changes. Returns false if cancelled. */
export function newSprite(editor: Editor, width: number, height: number): boolean {
  if (editor.getState().dirty && !window.confirm('Discard unsaved changes?')) return false;
  forgetFileHandle();
  editor.newSprite(clampSpriteSize(width), clampSpriteSize(height));
  return true;
}

/** Opens a file from the recent list (File menu, welcome screen, command palette). */
export async function openRecent(editor: Editor, path: string, name: string): Promise<void> {
  const file = await readRecentFile(path);
  if (file) await openAnyFile(editor, file);
  else editor.notify(`${name} was moved or deleted`);
}

/** Opens a `.raster` project or an image as a new document. */
export async function openAnyFile(editor: Editor, file: File): Promise<void> {
  if (editor.getState().dirty && !window.confirm('Discard unsaved changes?')) return;
  try {
    if (file.name.toLowerCase().endsWith(FILE_EXTENSION)) {
      const { sprite, palette, indexed } = await openProjectFile(file);
      editor.load(sprite, { palette, indexed, fileName: baseName(file.name) });
    } else if (file.type.startsWith('image/')) {
      forgetFileHandle();
      editor.load(await imageFileToSprite(file), { fileName: baseName(file.name), dirty: true });
    } else {
      editor.notify(`Can't open ${file.name}`);
    }
  } catch (e) {
    editor.notify(
      e instanceof FormatError || e instanceof RangeError ? e.message : `Can't open ${file.name}`,
    );
  }
}

/** Lets files be dropped anywhere on the window to open them. */
export function acceptDroppedFiles(editor: Editor): () => void {
  const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  };
  const onDrop = (e: DragEvent) => {
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    e.preventDefault();
    void openAnyFile(editor, file);
  };
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('drop', onDrop);
  return () => {
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('drop', onDrop);
  };
}
