import type { Editor } from '@editor/editor';
import { getSettings, subscribeSettings, updateSettings } from '@platform/settings';
import { clearAutosave } from './autosave';

/** Before preferences lived in settings.json, the update check was a localStorage flag. */
const LEGACY_AUTO_UPDATE_KEY = 'raster:autoUpdate';

function migrate(): void {
  try {
    if (localStorage.getItem(LEGACY_AUTO_UPDATE_KEY) === 'off')
      updateSettings({ checkUpdates: false });
    localStorage.removeItem(LEGACY_AUTO_UPDATE_KEY);
  } catch {
    // Nothing to migrate.
  }
}

/**
 * Keeps the editor in step with the preferences that affect it: the pixel
 * grid (also toggled from the View menu, which saves it back) and autosave.
 */
export function startPreferences(editor: Editor): () => void {
  migrate();
  editor.setOption({ showGrid: getSettings().showPixelGrid });

  let seen = getSettings();
  const offSettings = subscribeSettings(() => {
    const s = getSettings();
    if (s.showPixelGrid !== seen.showPixelGrid && s.showPixelGrid !== editor.getState().showGrid) {
      editor.setOption({ showGrid: s.showPixelGrid });
    }
    if (!s.autosave && seen.autosave) clearAutosave();
    seen = s;
  });

  let grid = editor.getState().showGrid;
  const offEditor = editor.subscribe(() => {
    const { showGrid } = editor.getState();
    if (showGrid === grid) return;
    grid = showGrid;
    if (showGrid !== getSettings().showPixelGrid) updateSettings({ showPixelGrid: showGrid });
  });

  return () => {
    offSettings();
    offEditor();
  };
}
