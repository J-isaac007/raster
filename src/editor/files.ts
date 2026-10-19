import { FILE_EXTENSION, parseProject, serializeProject, type Project } from '../core/format';
import { desktop, filterForName, filtersFromAccept, toFile, type PickedFile } from './desktop';

/**
 * File plumbing: open dialogs, saving and the open project's location. In the
 * desktop app this uses native dialogs; in a plain browser (development) it
 * falls back to file inputs and downloads.
 */

export async function pickFile(accept: string): Promise<PickedFile | null> {
  if (desktop) {
    const file = await desktop.openFile({ filters: filtersFromAccept(accept) });
    return file ? toFile(file) : null;
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

/** Saves a generated file: a native save dialog on desktop, a download in a browser. */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (desktop) {
    const bridge = desktop;
    void blob.arrayBuffer().then((data) =>
      bridge.saveFile({
        defaultName: fileName,
        filters: filterForName(fileName),
        data: new Uint8Array(data),
      }),
    );
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'untitled';
}

// ---- project files ----------------------------------------------------------

interface SaveFileHandle {
  name: string;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

interface FilePickerWindow {
  showSaveFilePicker?: (options: unknown) => Promise<SaveFileHandle>;
}

/** Remembered so Ctrl+S overwrites the file that's open. */
let currentPath: string | null = null;
let currentHandle: SaveFileHandle | null = null;

export function forgetFileHandle(): void {
  currentPath = null;
  currentHandle = null;
}

/**
 * Saves a project. Ctrl+S overwrites the open file; Save As (or a new
 * document) asks where. Returns the saved file's name, or null if cancelled.
 */
export async function saveProject(
  project: Project,
  fileName: string,
  saveAs = false,
): Promise<string | null> {
  const json = serializeProject(project);
  const name = baseName(fileName) + FILE_EXTENSION;

  if (desktop) {
    const saved = await desktop.saveFile({
      path: saveAs ? null : currentPath,
      defaultName: name,
      filters: [{ name: 'Raster project', extensions: [FILE_EXTENSION.slice(1)] }],
      data: new TextEncoder().encode(json),
    });
    if (!saved) return null;
    currentPath = saved;
    return saved.split(/[\\/]/).pop() ?? name;
  }

  const blob = new Blob([json], { type: 'application/json' });
  const picker = (window as FilePickerWindow).showSaveFilePicker;

  if (picker) {
    try {
      if (saveAs || !currentHandle) {
        currentHandle = await picker({
          suggestedName: name,
          types: [
            { description: 'Raster project', accept: { 'application/json': [FILE_EXTENSION] } },
          ],
        });
      }
      const writable = await currentHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return currentHandle.name;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null;
      throw e;
    }
  }

  downloadBlob(blob, name);
  return name;
}

export async function openProjectFile(file: PickedFile): Promise<Project> {
  forgetFileHandle();
  const project = parseProject(await file.text());
  currentPath = file.path ?? null;
  return project;
}
