import { useState } from 'react';
import type { Action } from '@app/commands';
import { checkForUpdates } from '@app/updates';
import { updateSettings } from '@platform/settings';
import { ACCENTS, CHECKER_SIZES, DEFAULT_SETTINGS } from '@shared/settings';
import { Button, Select, Switch, TextInput } from '../components';
import { useEditor } from '../editorContext';
import { ACCENT_COLORS } from '../theme';
import { useSettings } from '../useSettings';
import { Dialog, DialogActions } from './Dialog';
import { ShortcutTable } from './ShortcutsDialog';

const PANES = ['General', 'Canvas', 'Shortcuts', 'Updates'] as const;
type Pane = (typeof PANES)[number];

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

function GeneralPane() {
  const s = useSettings();
  return (
    <>
      <section className="prefs-group">
        <h3 className="prefs-heading">Appearance</h3>
        <div className="prefs-row">
          <span className="form-label">Accent color</span>
          <div className="accents" role="radiogroup" aria-label="Accent color">
            {ACCENTS.map((accent) => (
              <button
                key={accent}
                type="button"
                role="radio"
                aria-checked={s.accent === accent}
                aria-label={capitalize(accent)}
                title={capitalize(accent)}
                className="accent-swatch"
                style={{ background: ACCENT_COLORS[accent].base }}
                onClick={() => updateSettings({ accent })}
              />
            ))}
          </div>
        </div>
      </section>
      <section className="prefs-group">
        <h3 className="prefs-heading">Files</h3>
        <Switch
          label="Autosave"
          description="Keeps a copy of your sprite so a crash or quit loses nothing."
          checked={s.autosave}
          onChange={(autosave) => updateSettings({ autosave })}
        />
        <Switch
          label="Reopen the last sprite at startup"
          description="When off, Raster starts on the welcome screen. Unsaved work is always restored."
          checked={s.reopenLast}
          onChange={(reopenLast) => updateSettings({ reopenLast })}
        />
      </section>
    </>
  );
}

function CanvasPane() {
  const s = useSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const hex = draft ?? s.gridColor;
  const valid = /^#[0-9a-f]{6}$/i.test(hex);
  const commit = () => {
    if (draft !== null && valid) updateSettings({ gridColor: draft });
    setDraft(null);
  };
  return (
    <section className="prefs-group">
      <h3 className="prefs-heading">Canvas</h3>
      <div className="prefs-row">
        <label className="form-label" htmlFor="pref-checker">
          Checkerboard
        </label>
        <Select
          id="pref-checker"
          className="prefs-select"
          value={s.checkerSize}
          onChange={(e) => updateSettings({ checkerSize: e.target.value as typeof s.checkerSize })}
        >
          {CHECKER_SIZES.map((size) => (
            <option key={size} value={size}>
              {capitalize(size)} squares
            </option>
          ))}
        </Select>
      </div>
      <div className="prefs-row">
        <label className="form-label" htmlFor="pref-grid">
          Grid color
        </label>
        <div className="field-row">
          <input
            type="color"
            className="native-color"
            aria-label="Pick grid color"
            value={s.gridColor}
            onChange={(e) => updateSettings({ gridColor: e.target.value })}
          />
          <TextInput
            id="pref-grid"
            mono
            className="input-short"
            invalid={!valid}
            value={hex}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
      </div>
      <Switch
        label="Show the pixel grid when zoomed in"
        checked={s.showPixelGrid}
        onChange={(showPixelGrid) => updateSettings({ showPixelGrid })}
      />
    </section>
  );
}

function UpdatesPane() {
  const editor = useEditor();
  const s = useSettings();
  return (
    <section className="prefs-group">
      <h3 className="prefs-heading">Updates</h3>
      <Switch
        label="Check for updates when Raster starts"
        description="Asks GitHub for the latest release. Nothing else is sent."
        checked={s.checkUpdates}
        onChange={(checkUpdates) => updateSettings({ checkUpdates })}
      />
      <div className="prefs-row">
        <span className="form-label">Raster {__APP_VERSION__}</span>
        <Button onClick={() => checkForUpdates(editor)}>Check now</Button>
      </div>
    </section>
  );
}

/** Preferences, saved by the main process as they change (Figma: Dialog / Preferences). */
export function PreferencesDialog({
  onClose,
  actions,
}: {
  onClose: () => void;
  actions: Action[];
}) {
  const [pane, setPane] = useState<Pane>('General');
  return (
    <Dialog title="Preferences" onClose={onClose} wide>
      <div className="prefs">
        <nav className="prefs-nav" aria-label="Preference sections">
          {PANES.map((p) => (
            <button
              key={p}
              type="button"
              className="prefs-nav-item"
              aria-current={pane === p ? 'page' : undefined}
              onClick={() => setPane(p)}
            >
              {p}
            </button>
          ))}
        </nav>
        <div className="prefs-content">
          {pane === 'General' && <GeneralPane />}
          {pane === 'Canvas' && <CanvasPane />}
          {pane === 'Shortcuts' && (
            <section className="prefs-group">
              <h3 className="prefs-heading">Shortcuts</h3>
              <div className="prefs-scroll">
                <ShortcutTable actions={actions} />
              </div>
            </section>
          )}
          {pane === 'Updates' && <UpdatesPane />}
        </div>
      </div>
      <DialogActions>
        <Button variant="ghost" onClick={() => updateSettings({ ...DEFAULT_SETTINGS })}>
          Reset to defaults
        </Button>
        <span className="spacer" />
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
