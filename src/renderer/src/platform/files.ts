import { FILE_EXTENSION, parseProject, serializeProject, type Project } from '@core/format';
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

/**
 * Saves a file that can be written in several formats: the save dialog offers
 * each, and the file gets the format of the chosen name. In a browser the
 * first format is downloaded. `formats` maps an extension to its label and contents.
 */
export function saveFileAs(
  baseFileName: string,
  formats: { extension: string; label: string; text: string }[],
): void {
  const [first] = formats;
  const encode = (text: string) => new TextEncoder().encode(text);
  if (desktop) {
    void desktop.saveFile({
      defaultName: `${baseFileName}.${first.extension}`,
      filters: formats.map((f) => ({ name: f.label, extensions: [f.extension] })),
      data: encode(first.text),
      variants: Object.fromEntries(formats.map((f) => [f.extension, encode(f.text)])),
    });
    return;
  }
  downloadBlob(
    new Blob([first.text], { type: 'text/plain' }),
    `${baseFileName}.${first.extension}`,
  );
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'untitled';
}

// ---- project files ----------------------------------------------------------

export interface SaveFileHandle {
  name: string;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

interface FilePickerWindow {
  showSaveFilePicker?: (options: unknown) => Promise<SaveFileHandle>;
}

/**
 * Where a document was opened from or saved to, so Ctrl+S overwrites it.
 * Each open document (tab) has its own.
 */
export interface FileRef {
  /** Desktop: the file's path. */
  path: string | null;
  /** Browser (development): a File System Access handle. */
  handle: SaveFileHandle | null;
}

export const newFileRef = (path: string | null = null): FileRef => ({ path, handle: null });

/**
 * Saves a project. Ctrl+S overwrites the open file; Save As (or a new
 * document) asks where. Returns the saved file's name, or null if cancelled.
 */
export async function saveProject(
  project: Project,
  fileName: string,
  ref: FileRef,
  saveAs = false,
): Promise<string | null> {
  const json = serializeProject(project);
  const name = baseName(fileName) + FILE_EXTENSION;

  if (desktop) {
    const saved = await desktop.saveFile({
      path: saveAs ? null : ref.path,
      defaultName: name,
      filters: [{ name: 'Raster project', extensions: [FILE_EXTENSION.slice(1)] }],
      data: new TextEncoder().encode(json),
    });
    if (!saved) return null;
    ref.path = saved;
    return saved.split(/[\\/]/).pop() ?? name;
  }

  const blob = new Blob([json], { type: 'application/json' });
  const picker = (window as FilePickerWindow).showSaveFilePicker;

  if (picker) {
    try {
      if (saveAs || !ref.handle) {
        ref.handle = await picker({
          suggestedName: name,
          types: [
            { description: 'Raster project', accept: { 'application/json': [FILE_EXTENSION] } },
          ],
        });
      }
      const writable = await ref.handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return ref.handle.name;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null;
      throw e;
    }
  }

  downloadBlob(blob, name);
  return name;
}

/** Reads a project file; `ref` remembers where it came from (desktop). */
export async function openProjectFile(
  file: PickedFile,
): Promise<{ project: Project; ref: FileRef }> {
  const project = parseProject(await file.text());
  return { project, ref: newFileRef(file.path ?? null) };
}
