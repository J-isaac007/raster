import { Pencil, Trash2 } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  applyPalette,
  importPaletteFile,
  PALETTE_ACCEPT,
  renameSavedPalette,
  saveCurrentPalette,
  savedColors,
} from '@app/palettes';
import { toHex, type Color } from '@core/color';
import { BUILTIN_PALETTES, PALETTE_GROUPS } from '@core/palettes';
import { pickFile } from '@platform/files';
import { deletePalette, type SavedPalette } from '@platform/palettes';
import { Button, IconButton, TextInput } from '../components';
import { useEditor } from '../editorContext';
import { useSavedPalettes } from '../useSettings';
import { Dialog, DialogActions, DialogNote } from './Dialog';

interface Entry {
  key: string;
  name: string;
  meta: string;
  /** Matched by the search box, lowercase. */
  search: string;
  colors: Color[];
  saved?: SavedPalette;
}

interface Section {
  title: string;
  entries: Entry[];
  /** Shown when the section has nothing in it. */
  empty?: string;
}

const countLabel = (n: number) => `${n} ${n === 1 ? 'color' : 'colors'}`;

const sameColors = (a: readonly Color[], b: readonly Color[]) =>
  a.length === b.length && a.every((c, i) => c === b[i]);

const BUILTIN_SECTIONS: Section[] = PALETTE_GROUPS.map((group) => ({
  title: group,
  entries: BUILTIN_PALETTES.filter((p) => p.group === group).map((p) => ({
    key: `builtin:${p.id}`,
    name: p.name,
    meta: `${p.author} · ${countLabel(p.colors.length)}`,
    search: `${p.name} ${p.author}`.toLowerCase(),
    colors: [...p.colors],
  })),
}));

const savedEntry = (p: SavedPalette): Entry => {
  const colors = savedColors(p);
  return {
    key: `saved:${p.id}`,
    name: p.name,
    meta: `My palette · ${countLabel(colors.length)}`,
    search: p.name.toLowerCase(),
    colors,
    saved: p,
  };
};

/**
 * The palette library (Figma: Dialog / Palettes): My palettes and the
 * built-in palettes, with search, import, save, rename and delete. `save`
 * opens it naming a new entry for the sprite's palette.
 */
export function PaletteBrowserDialog({ onClose, save }: { onClose: () => void; save?: boolean }) {
  const editor = useEditor();
  const library = useSavedPalettes();
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sections = useMemo<Section[]>(
    () => [
      {
        title: 'My palettes',
        entries: library.map(savedEntry),
        empty: 'Palettes you import or save show up here.',
      },
      ...BUILTIN_SECTIONS,
    ],
    [library],
  );

  const q = query.trim().toLowerCase();
  const shown = sections
    .map((s) => ({ ...s, entries: q ? s.entries.filter((e) => e.search.includes(q)) : s.entries }))
    .filter((s) => s.entries.length > 0 || (!q && s.empty));
  const flat = shown.flatMap((s) => s.entries);

  // Start on the palette the sprite uses, if it's in the library.
  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    const current = editor.getState().palette;
    const all = sections.flatMap((s) => s.entries);
    return (
      (all.find((e) => sameColors(e.colors, current)) ?? all.find((e) => !e.saved))?.key ?? null
    );
  });
  const selected = flat.find((e) => e.key === selectedKey) ?? null;

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedKey, query]);

  const saveCurrent = async () => {
    const entry = await saveCurrentPalette(editor, `${editor.getState().fileName} palette`);
    if (!entry) return;
    setQuery('');
    setSelectedKey(`saved:${entry.id}`);
    setRenaming({ id: entry.id, name: entry.name });
  };

  // "Save Current Palette…" opens the browser straight into naming the new entry.
  const saveOnOpen = useRef(save);
  useEffect(() => {
    if (!saveOnOpen.current) return;
    saveOnOpen.current = false;
    void saveCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importFile = async () => {
    const file = await pickFile(PALETTE_ACCEPT);
    if (!file) return;
    const entry = await importPaletteFile(editor, file, { apply: false });
    if (!entry) return;
    setQuery('');
    setSelectedKey(`saved:${entry.id}`);
  };

  const apply = (entry: Entry | null, mode: 'replace' | 'add') => {
    if (!entry) return;
    applyPalette(editor, entry.name, entry.colors, mode);
    onClose();
  };

  const remove = async (p: SavedPalette) => {
    if (!window.confirm(`Delete "${p.name}" from My palettes? This can't be undone.`)) return;
    await deletePalette(p.id);
    if (selectedKey === `saved:${p.id}`) setSelectedKey(null);
  };

  const commitRename = async () => {
    if (!renaming) return;
    const p = library.find((x) => x.id === renaming.id);
    setRenaming(null);
    if (p) await renameSavedPalette(p, renaming.name);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (renaming || flat.length === 0) return;
    const i = flat.findIndex((x) => x.key === selectedKey);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = i < 0 ? 0 : Math.min(flat.length - 1, Math.max(0, i + step));
      setSelectedKey(flat[next].key);
    } else if (e.key === 'Enter' && selected) {
      e.preventDefault();
      apply(selected, 'replace');
    }
  };

  return (
    <Dialog title="Palettes" onClose={onClose} className="dialog-palettes">
      <div className="palette-browser" onKeyDown={onKeyDown}>
        <TextInput
          type="search"
          placeholder="Search palettes or authors"
          aria-label="Search palettes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="palette-list" role="listbox" aria-label="Palettes" ref={listRef}>
          {shown.length === 0 && <p className="palette-empty">No palettes match “{query}”.</p>}
          {shown.map((section) => (
            <div key={section.title} role="group" aria-label={section.title}>
              <h3 className="palette-heading">{section.title}</h3>
              {section.entries.length === 0 && <p className="palette-empty">{section.empty}</p>}
              {section.entries.map((entry) => (
                <div
                  key={entry.key}
                  role="option"
                  aria-selected={entry.key === selectedKey}
                  className="palette-row"
                  onClick={() => setSelectedKey(entry.key)}
                  onDoubleClick={() => !renaming && apply(entry, 'replace')}
                >
                  <span className="palette-row-text">
                    {renaming && entry.saved?.id === renaming.id ? (
                      <TextInput
                        compact
                        autoFocus
                        data-own-escape
                        aria-label="Palette name"
                        maxLength={60}
                        value={renaming.name}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                        onBlur={() => void commitRename()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitRename();
                          if (e.key === 'Escape') setRenaming(null);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="palette-row-name">{entry.name}</span>
                    )}
                    <span className="palette-row-meta">{entry.meta}</span>
                  </span>
                  {entry.saved && (
                    <span className="palette-row-actions">
                      <IconButton
                        icon={Pencil}
                        label="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenaming({ id: entry.saved!.id, name: entry.saved!.name });
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                      <IconButton
                        icon={Trash2}
                        label="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          void remove(entry.saved!);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    </span>
                  )}
                  <span className="palette-strip-slot">
                    <PaletteStrip colors={entry.colors} />
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <DialogNote>
          Double-click a palette to use it. In indexed color, every pixel snaps to the new palette.
        </DialogNote>
      </div>
      <DialogActions>
        <Button variant="ghost" onClick={() => void importFile()}>
          Import…
        </Button>
        <Button variant="ghost" onClick={() => void saveCurrent()}>
          Save current palette…
        </Button>
        <span className="spacer" />
        <Button disabled={!selected} onClick={() => apply(selected, 'add')}>
          Add colors
        </Button>
        <Button variant="primary" disabled={!selected} onClick={() => apply(selected, 'replace')}>
          Use palette
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * A palette's colors in one 256 × 16 strip: 16 px squares for small
 * palettes, then up to 32 per row, rows stacked for bigger ones.
 */
function PaletteStrip({ colors }: { colors: readonly Color[] }) {
  const n = Math.max(1, colors.length);
  const cols = Math.min(n, 32);
  const rows = Math.ceil(n / 32);
  const style = {
    '--cols': cols,
    '--cell': `${n <= 16 ? 16 : 256 / cols}px`,
    '--row': `${16 / rows}px`,
  } as CSSProperties;
  return (
    <span className="palette-strip" style={style} aria-hidden="true">
      {colors.map((c, i) => (
        <span key={i} style={{ background: toHex(c) }} />
      ))}
    </span>
  );
}
