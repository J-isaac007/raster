import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { encodeGif } from '../core/gif';
import { layoutSheet, packSheet, sheetMetadata } from '../core/sheet';
import { MAX_SPRITE_SIZE } from '../core/sprite';
import { formatKeys, type Action } from '../editor/actions';
import { useEditor, useEditorState } from '../editor/context';
import {
  APP_URL,
  detectPlatform,
  getInstallState,
  INSTALL_GUIDE_URL,
  INSTALL_STEPS,
  promptInstall,
  subscribeInstall,
} from '../editor/pwa';
import { Logo } from './Logo';
import type { Editor, TileMode } from '../editor/editor';
import {
  baseName,
  canvasToPng,
  downloadBlob,
  forgetFileHandle,
  pixelsToCanvas,
} from '../editor/io';

function Dialog({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    ref.current?.querySelector<HTMLElement>('input, select, button.primary')?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`dialog${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

const clampSize = (n: number) => Math.min(MAX_SPRITE_SIZE, Math.max(1, Math.round(n) || 1));
const SIZE_PRESETS = [16, 32, 48, 64, 128, 256];

function SizeFields({
  width,
  height,
  setWidth,
  setHeight,
}: {
  width: number;
  height: number;
  setWidth: (n: number) => void;
  setHeight: (n: number) => void;
}) {
  return (
    <>
      <label htmlFor="size-w">Width</label>
      <input
        id="size-w"
        className="text-input"
        type="number"
        min={1}
        max={MAX_SPRITE_SIZE}
        value={width}
        onChange={(e) => setWidth(+e.target.value)}
      />
      <label htmlFor="size-h">Height</label>
      <input
        id="size-h"
        className="text-input"
        type="number"
        min={1}
        max={MAX_SPRITE_SIZE}
        value={height}
        onChange={(e) => setHeight(+e.target.value)}
      />
    </>
  );
}

export function NewSpriteDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);

  const create = () => {
    if (editor.getState().dirty && !window.confirm('Discard unsaved changes?')) return;
    forgetFileHandle();
    editor.newSprite(clampSize(width), clampSize(height));
    onClose();
  };

  return (
    <Dialog title="New Sprite" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <div className="form-grid">
          <SizeFields width={width} height={height} setWidth={setWidth} setHeight={setHeight} />
          <span className="hint">Presets</span>
          <div className="chips">
            {SIZE_PRESETS.map((n) => (
              <button
                type="button"
                key={n}
                className="chip"
                aria-pressed={width === n && height === n}
                onClick={() => {
                  setWidth(n);
                  setHeight(n);
                }}
              >
                {n}²
              </button>
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Create
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function CanvasSizeDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const s = editor.getState();
  const [width, setWidth] = useState(s.width);
  const [height, setHeight] = useState(s.height);
  const [anchor, setAnchor] = useState({ x: 0.5, y: 0.5 });

  const apply = () => {
    editor.resizeCanvas(clampSize(width), clampSize(height), anchor.x, anchor.y);
    onClose();
  };

  return (
    <Dialog title="Canvas Size" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="form-grid">
          <SizeFields width={width} height={height} setWidth={setWidth} setHeight={setHeight} />
          <span className="hint">Anchor</span>
          <div className="anchor-grid">
            {[0, 0.5, 1].flatMap((y) =>
              [0, 0.5, 1].map((x) => (
                <button
                  type="button"
                  key={`${x}-${y}`}
                  aria-label={`Anchor ${y === 0 ? 'top' : y === 1 ? 'bottom' : 'middle'} ${x === 0 ? 'left' : x === 1 ? 'right' : 'center'}`}
                  aria-pressed={anchor.x === x && anchor.y === y}
                  onClick={() => setAnchor({ x, y })}
                />
              )),
            )}
          </div>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Shrinking crops pixels outside the new bounds. You can undo this.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Resize
          </button>
        </div>
      </form>
    </Dialog>
  );
}

type ExportFormat = 'png' | 'gif' | 'sheet';

const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: 'PNG (this frame)',
  gif: 'Animated GIF',
  sheet: 'Sprite sheet',
};

interface ExportSettings {
  format: ExportFormat;
  scale: number;
  columns: number;
  padding: number;
}

const allFrames = (editor: Editor) =>
  Array.from({ length: editor.frameCount }, (_, i) => editor.flattenFrame(i));

function renderGif(editor: Editor, scale: number): Uint8Array {
  const { width, height, frames } = editor.getState();
  return encodeGif(
    width,
    height,
    allFrames(editor).map((pixels, i) => ({ pixels, delayMs: frames[i] })),
    { scale },
  );
}

function gifDataUrl(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/gif;base64,${btoa(bin)}`;
}

/** Renders the PNG formats: the current frame, or every frame as a sheet. */
function renderCanvas(editor: Editor, o: ExportSettings): HTMLCanvasElement {
  const { width, height, frame } = editor.getState();
  if (o.format === 'sheet') {
    const sheet = packSheet(allFrames(editor), width, height, {
      columns: o.columns,
      padding: o.padding,
    });
    return pixelsToCanvas(sheet.pixels, sheet.width, sheet.height, o.scale);
  }
  return pixelsToCanvas(editor.flattenFrame(frame), width, height, o.scale);
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const s = editor.getState();
  const frameCount = s.frames.length;
  const [format, setFormat] = useState<ExportFormat>(frameCount > 1 ? 'gif' : 'png');
  const [scale, setScale] = useState(() =>
    Math.max(1, Math.min(16, Math.floor(512 / Math.max(s.width, s.height)))),
  );
  const [columns, setColumns] = useState(Math.ceil(Math.sqrt(frameCount)));
  const [padding, setPadding] = useState(0);
  const [withJson, setWithJson] = useState(true);
  const [name, setName] = useState(s.fileName);
  const [busy, setBusy] = useState(false);

  const cols = Math.min(frameCount, Math.max(1, Math.round(columns) || 1));
  const rows = Math.ceil(frameCount / cols);
  const outW =
    format === 'sheet' ? (cols * s.width + (cols - 1) * padding) * scale : s.width * scale;
  const outH =
    format === 'sheet' ? (rows * s.height + (rows - 1) * padding) * scale : s.height * scale;

  // Preview at 1× (GIF previews animate).
  const preview = useMemo(() => {
    if (format === 'gif') return gifDataUrl(renderGif(editor, 1));
    return renderCanvas(editor, { format, scale: 1, columns: cols, padding }).toDataURL();
  }, [editor, format, cols, padding]);

  const run = async () => {
    setBusy(true);
    const file = baseName(name.trim() || 'sprite');
    const settings = { format, scale, columns: cols, padding };
    try {
      if (format === 'gif') {
        const bytes = renderGif(editor, scale);
        downloadBlob(new Blob([bytes as BlobPart], { type: 'image/gif' }), `${file}.gif`);
      } else {
        downloadBlob(await canvasToPng(renderCanvas(editor, settings)), `${file}.png`);
        if (format === 'sheet' && withJson) {
          const layout = layoutSheet(frameCount, s.width * scale, s.height * scale, {
            columns: cols,
            padding: padding * scale,
          });
          const meta = sheetMetadata(layout, `${file}.png`, s.frames, (i) => `${file} ${i}`);
          downloadBlob(new Blob([meta], { type: 'application/json' }), `${file}.json`);
        }
      }
      onClose();
    } catch {
      editor.notify('Export failed');
      setBusy(false);
    }
  };

  return (
    <Dialog title="Export" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <div
          className="checker"
          style={{
            display: 'grid',
            placeItems: 'center',
            height: 150,
            marginBottom: 14,
            borderRadius: 6,
          }}
        >
          <img
            src={preview}
            alt="Export preview"
            style={{
              maxWidth: '90%',
              maxHeight: 130,
              imageRendering: 'pixelated',
              minWidth: Math.min(130, (format === 'sheet' ? outW / scale : s.width) * 4),
            }}
          />
        </div>
        <div className="form-grid">
          <span className="hint">Format</span>
          <div className="chips">
            {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
              <button
                type="button"
                key={f}
                className="chip"
                aria-pressed={format === f}
                onClick={() => setFormat(f)}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
          <label htmlFor="export-name">File name</label>
          <input
            id="export-name"
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="hint">Scale</span>
          <div className="chips">
            {[1, 2, 4, 8, 16].map((n) => (
              <button
                type="button"
                key={n}
                className="chip"
                aria-pressed={scale === n}
                onClick={() => setScale(n)}
              >
                {n}×
              </button>
            ))}
          </div>
          {format === 'sheet' && (
            <>
              <label htmlFor="export-cols">Columns</label>
              <input
                id="export-cols"
                className="text-input"
                type="number"
                min={1}
                max={frameCount}
                value={columns}
                onChange={(e) => setColumns(+e.target.value)}
              />
              <span className="hint">Padding</span>
              <div className="chips">
                {[0, 1, 2, 4].map((n) => (
                  <button
                    type="button"
                    key={n}
                    className="chip"
                    aria-pressed={padding === n}
                    onClick={() => setPadding(n)}
                  >
                    {n}px
                  </button>
                ))}
              </div>
              <span className="hint">Data</span>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={withJson}
                  onChange={(e) => setWithJson(e.target.checked)}
                />
                Also save frame data (.json)
              </label>
            </>
          )}
          <span className="hint">Output</span>
          <span>
            {outW} × {outH} px
            {format !== 'png' && ` · ${frameCount} frame${frameCount === 1 ? '' : 's'}`}
          </span>
        </div>
        {format === 'gif' && (
          <p className="hint" style={{ marginTop: 12 }}>
            GIF supports 256 colors and on/off transparency. Partly transparent pixels become fully
            opaque or fully clear.
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            Export
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const TILE_MODES: [TileMode, string][] = [
  ['off', 'Off'],
  ['both', 'Both'],
  ['x', 'Horizontal'],
  ['y', 'Vertical'],
];

export function GridDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const s = useEditorState((s) => ({
    showGrid: s.showGrid,
    showTileGrid: s.showTileGrid,
    tileGrid: s.tileGrid,
    tileMode: s.tileMode,
  }));
  const [width, setWidth] = useState(s.tileGrid.width);
  const [height, setHeight] = useState(s.tileGrid.height);

  return (
    <Dialog title="Grid & Tiles" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          editor.setTileGrid(width, height);
          onClose();
        }}
      >
        <div className="form-grid">
          <span className="hint">Pixel grid</span>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={s.showGrid}
              onChange={(e) => editor.setOption({ showGrid: e.target.checked })}
            />
            Show when zoomed in
          </label>
          <span className="hint">Tile grid</span>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={s.showTileGrid}
              onChange={(e) => editor.setOption({ showTileGrid: e.target.checked })}
            />
            Show
          </label>
          <label htmlFor="tile-w">Tile width</label>
          <input
            id="tile-w"
            className="text-input"
            type="number"
            min={1}
            max={1024}
            value={width}
            onChange={(e) => setWidth(+e.target.value)}
          />
          <label htmlFor="tile-h">Tile height</label>
          <input
            id="tile-h"
            className="text-input"
            type="number"
            min={1}
            max={1024}
            value={height}
            onChange={(e) => setHeight(+e.target.value)}
          />
          <span className="hint">Tile mode</span>
          <div className="chips">
            {TILE_MODES.map(([mode, label]) => (
              <button
                type="button"
                key={mode}
                className="chip"
                aria-pressed={s.tileMode === mode}
                onClick={() => editor.setOption({ tileMode: mode })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Tile mode repeats the sprite around the canvas and wraps strokes across its edges, so you
          can paint seamless textures.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Done
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const EXTRA_SHORTCUTS: [string, string][] = [
  ['Pan', 'Space + drag, or middle mouse'],
  ['Zoom at cursor', 'Mouse wheel'],
  ['Pick color', 'Alt + click'],
  ['Straight line from last point', 'Shift + click'],
  ['Snap line / square shape', 'Hold Shift'],
  ['Paint with secondary color', 'Right click'],
  ['Move selection', 'Drag inside it (select tool)'],
];

export function ShortcutsDialog({ onClose, actions }: { onClose: () => void; actions: Action[] }) {
  return (
    <Dialog title="Keyboard Shortcuts" onClose={onClose} wide>
      <div className="shortcut-table">
        {actions
          .filter((a) => a.keys?.length)
          .map((a) => (
            <div key={a.id} style={{ display: 'contents' }}>
              <span>{a.label}</span>
              <kbd>{a.keys!.map(formatKeys).join(' / ')}</kbd>
            </div>
          ))}
        {EXTRA_SHORTCUTS.map(([label, keys]) => (
          <div key={label} style={{ display: 'contents' }}>
            <span>{label}</span>
            <kbd>{keys}</kbd>
          </div>
        ))}
      </div>
      <div className="dialog-actions">
        <button className="btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}

export function InstallDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const install = useSyncExternalStore(subscribeInstall, getInstallState);
  const platform = useMemo(() => detectPlatform(), []);
  const guide = INSTALL_STEPS[platform];
  const hosted = window.location.origin + window.location.pathname;
  const isOfficial = hosted.startsWith(APP_URL);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      editor.notify('Link copied');
    } catch {
      editor.notify('Couldn’t copy the link');
    }
  };

  return (
    <Dialog title="Install Raster" onClose={onClose}>
      {install.installed ? (
        <p>You’re using the installed app. It works offline and updates itself.</p>
      ) : (
        <p>
          Install Raster to get its own window and icon, open <code>.raster</code> files from your
          desktop, and work offline. It’s free and there’s nothing to download separately.
        </p>
      )}

      {install.canPrompt && (
        <button
          className="btn primary"
          style={{ width: '100%', marginBottom: 14 }}
          onClick={async () => {
            if (await promptInstall()) onClose();
          }}
        >
          Install now
        </button>
      )}

      {!install.installed && (
        <div className="install-steps">
          <strong>{guide.label}</strong>
          <ol>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="form-grid" style={{ marginTop: 14 }}>
        <span className="hint">Web app</span>
        <div className="field-row">
          <input
            className="text-input mono"
            style={{ fontSize: 11 }}
            readOnly
            value={APP_URL}
            aria-label="Raster web address"
            onFocus={(e) => e.target.select()}
          />
          <button className="btn" type="button" onClick={copyLink}>
            Copy
          </button>
        </div>
      </div>
      {!isOfficial && (
        <p className="hint" style={{ marginTop: 10 }}>
          You’re on a self-hosted or development copy. Install steps work here too.
        </p>
      )}
      <p className="hint" style={{ marginTop: 10 }}>
        Other devices, updating and uninstalling:{' '}
        <a href={INSTALL_GUIDE_URL} target="_blank" rel="noreferrer">
          install guide
        </a>
        .
      </p>
      <div className="dialog-actions">
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="About Raster" onClose={onClose}>
      <div style={{ display: 'grid', placeItems: 'center', margin: '4px 0 16px' }}>
        <Logo size={80} />
      </div>
      <p>
        <strong style={{ color: 'var(--text)' }}>Raster</strong> {__APP_VERSION__} — a free, open
        source pixel art editor.
      </p>
      <p>Released under the MIT License. Contributions are welcome.</p>
      <div className="dialog-actions">
        <button className="btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
