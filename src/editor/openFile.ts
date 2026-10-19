import { FILE_EXTENSION, FormatError } from '../core/format';
import type { Editor } from './editor';
import { baseName, forgetFileHandle, imageFileToSprite, openProjectFile } from './io';

/** Opens a `.raster` project or an image as a new document. */
export async function openAnyFile(editor: Editor, file: File): Promise<void> {
  if (editor.getState().dirty && !window.confirm('Discard unsaved changes?')) return;
  try {
    if (file.name.toLowerCase().endsWith(FILE_EXTENSION)) {
      const { sprite, palette } = await openProjectFile(file);
      editor.load(sprite, { palette, fileName: baseName(file.name) });
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
