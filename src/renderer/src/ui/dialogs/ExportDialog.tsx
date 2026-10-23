import { useMemo, useState } from 'react';
import { encodeGif } from '@core/gif';
import { layoutSheet, packSheet, sheetMetadata } from '@core/sheet';
import type { Editor } from '@editor/editor';
import { baseName, downloadBlob } from '@platform/files';
import { canvasToPng, pixelsToCanvas } from '@platform/image';
import { Button, Checkbox, Chip, Chips, TextInput } from '../components';
import { useEditor } from '../editorContext';
import { Dialog, DialogActions, DialogNote } from './Dialog';
import { Preview } from './Preview';

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
  /** Indices of the frames to export (GIF and sprite sheet). */
  frames: number[];
}

const flattenFrames = (editor: Editor, frames: number[]) =>
  frames.map((i) => editor.flattenFrame(i));

function renderGif(editor: Editor, scale: number, frames: number[]): Uint8Array {
  const { width, height, frames: durations } = editor.getState();
  return encodeGif(
    width,
    height,
    flattenFrames(editor, frames).map((pixels, i) => ({ pixels, delayMs: durations[frames[i]] })),
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
    const sheet = packSheet(flattenFrames(editor, o.frames), width, height, {
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
  const [range, setRange] = useState(-1);
  const tag = s.tags[range] ?? null;
  const frames = useMemo(
    () =>
      tag
        ? Array.from({ length: tag.to - tag.from + 1 }, (_, i) => tag.from + i)
        : s.frames.map((_, i) => i),
    [tag, s.frames],
  );
  const frameCount = frames.length;
  const [format, setFormat] = useState<ExportFormat>(s.frames.length > 1 ? 'gif' : 'png');
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
    if (format === 'gif') return gifDataUrl(renderGif(editor, 1, frames));
    return renderCanvas(editor, { format, scale: 1, columns: cols, padding, frames }).toDataURL();
  }, [editor, format, cols, padding, frames]);

  const run = async () => {
    setBusy(true);
    const file = baseName(name.trim() || 'sprite');
    const settings = { format, scale, columns: cols, padding, frames };
    try {
      if (format === 'gif') {
        const bytes = renderGif(editor, scale, frames);
        downloadBlob(new Blob([bytes as BlobPart], { type: 'image/gif' }), `${file}.gif`);
      } else {
        downloadBlob(await canvasToPng(renderCanvas(editor, settings)), `${file}.png`);
        if (format === 'sheet' && withJson) {
          const layout = layoutSheet(frameCount, s.width * scale, s.height * scale, {
            columns: cols,
            padding: padding * scale,
          });
          const meta = sheetMetadata(
            layout,
            `${file}.png`,
            frames.map((i) => s.frames[i]),
            (i) => `${file} ${i}`,
            tag ? [{ ...tag, from: 0, to: frameCount - 1 }] : s.tags,
          );
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
    <Dialog title="Export" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <Preview
          src={preview}
          alt="Export preview"
          minWidth={Math.min(130, (format === 'sheet' ? outW / scale : s.width) * 4)}
        />
        <div className="form-grid">
          <span className="form-label">Format</span>
          <Chips>
            {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
              <Chip key={f} pressed={format === f} onClick={() => setFormat(f)}>
                {FORMAT_LABELS[f]}
              </Chip>
            ))}
          </Chips>
          {format !== 'png' && s.tags.length > 0 && (
            <>
              <span className="form-label">Frames</span>
              <Chips>
                {[-1, ...s.tags.keys()].map((i) => (
                  <Chip key={i} pressed={range === i} onClick={() => setRange(i)}>
                    {i < 0 ? 'All' : s.tags[i].name}
                  </Chip>
                ))}
              </Chips>
            </>
          )}
          <label htmlFor="export-name">File name</label>
          <TextInput id="export-name" value={name} onChange={(e) => setName(e.target.value)} />
          <span className="form-label">Scale</span>
          <Chips>
            {[1, 2, 4, 8, 16].map((n) => (
              <Chip key={n} pressed={scale === n} onClick={() => setScale(n)}>
                {n}×
              </Chip>
            ))}
          </Chips>
          {format === 'sheet' && (
            <>
              <label htmlFor="export-cols">Columns</label>
              <TextInput
                id="export-cols"
                className="input-short"
                type="number"
                min={1}
                max={frameCount}
                value={columns}
                onChange={(e) => setColumns(+e.target.value)}
              />
              <span className="form-label">Padding</span>
              <Chips>
                {[0, 1, 2, 4].map((n) => (
                  <Chip key={n} pressed={padding === n} onClick={() => setPadding(n)}>
                    {n} px
                  </Chip>
                ))}
              </Chips>
              <span className="form-label">Data</span>
              <Checkbox
                label="Also save frame data (.json)"
                checked={withJson}
                onChange={setWithJson}
              />
            </>
          )}
          <span className="form-label">Output</span>
          <span className="mono">
            {outW} × {outH} px
            {format !== 'png' && ` · ${frameCount} frame${frameCount === 1 ? '' : 's'}`}
          </span>
        </div>
        {format === 'gif' && (
          <DialogNote>
            GIF supports 256 colors and on/off transparency. Partly transparent pixels become fully
            opaque or fully clear.
          </DialogNote>
        )}
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Export
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
