import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DITHER_LEVELS, type CustomBrush } from '../core/brush';
import { useEditor, useEditorState } from '../editor/context';
import { MAX_BRUSH, type ToolId } from '../editor/editor';
import { TOOL_BY_ID } from '../editor/tools';

const BRUSH_TOOLS: ToolId[] = ['pencil', 'eraser', 'shade', 'line', 'rect', 'ellipse'];
const DITHER_TOOLS: ToolId[] = ['pencil', 'line', 'rect', 'ellipse', 'fill'];
const DITHER_OPTIONS: [string, number][] = [
  ['Solid', DITHER_LEVELS],
  ['75%', 12],
  ['50%', 8],
  ['25%', 4],
  ['12%', 2],
];

const HINTS: Partial<Record<ToolId, string>> = {
  picker: 'Left click picks primary, right click picks secondary.',
  select: 'Drag to select · drag inside to move · Shift for a square · click to deselect',
  lasso: 'Drag around an area · drag inside to move · Shift adds · Ctrl subtracts',
  wand: 'Click to select a color · drag inside to move · Shift adds · Ctrl subtracts',
  shade: 'Left click lightens, right click darkens · steps along palette ramps',
};

/** A small pixelated preview of a custom brush. */
function BrushThumb({ brush }: { brush: CustomBrush }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = brush.width;
    canvas.height = brush.height;
    const img = new ImageData(brush.width, brush.height);
    img.data.set(
      new Uint8ClampedArray(brush.pixels.buffer, brush.pixels.byteOffset, brush.pixels.byteLength),
    );
    canvas.getContext('2d')!.putImageData(img, 0, 0);
  }, [brush]);
  const k = 20 / Math.max(brush.width, brush.height);
  return (
    <canvas
      ref={ref}
      className="brush-thumb prism"
      style={{ width: Math.max(1, brush.width * k), height: Math.max(1, brush.height * k) }}
      aria-hidden="true"
    />
  );
}

export function ToolOptions() {
  const editor = useEditor();
  const s = useEditorState((s) => ({
    tool: s.tool,
    brushSize: s.brushSize,
    shapeFilled: s.shapeFilled,
    fillContiguous: s.fillContiguous,
    wandContiguous: s.wandContiguous,
    mirrorX: s.mirrorX,
    mirrorY: s.mirrorY,
    pixelPerfect: s.pixelPerfect,
    dither: s.dither,
    customBrush: s.customBrush,
    brushMode: s.brushMode,
  }));
  const usesBrush = BRUSH_TOOLS.includes(s.tool);
  const isShape = s.tool === 'rect' || s.tool === 'ellipse';
  const hint = HINTS[s.tool];

  return (
    <div className="options" role="toolbar" aria-label="Tool options">
      <span className="tool-name">{TOOL_BY_ID[s.tool].label}</span>

      {usesBrush && s.customBrush && (
        <div className="custom-brush" title="Custom brush (Ctrl+B makes one from a selection)">
          <BrushThumb brush={s.customBrush} />
          <span className="range-label" style={{ width: 'auto' }}>
            {s.customBrush.width}×{s.customBrush.height}
          </span>
          {s.tool !== 'eraser' && s.tool !== 'shade' && (
            <select
              className="text-input"
              aria-label="Custom brush colors"
              style={{ height: 24, width: 116, padding: '0 4px' }}
              value={s.brushMode}
              onChange={(e) => editor.setOption({ brushMode: e.target.value as 'image' | 'color' })}
            >
              <option value="image">Brush colors</option>
              <option value="color">Current color</option>
            </select>
          )}
          <button
            className="icon-btn"
            title="Use the square brush (Ctrl+Shift+B)"
            aria-label="Use the square brush"
            onClick={() => editor.clearCustomBrush()}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {usesBrush && !s.customBrush && (
        <label title="Brush size ([ and ])">
          Size
          <input
            type="range"
            min={1}
            max={MAX_BRUSH}
            value={s.brushSize}
            style={{ width: 110 }}
            onChange={(e) => editor.setBrushSize(+e.target.value)}
          />
          <span className="range-label">{s.brushSize}px</span>
        </label>
      )}

      {(s.tool === 'pencil' || s.tool === 'eraser') && (
        <label title="Removes L-shaped corners so freehand lines stay one pixel thin (1px brush)">
          <input
            type="checkbox"
            checked={s.pixelPerfect}
            disabled={s.brushSize !== 1 || s.customBrush !== null}
            onChange={(e) => editor.setOption({ pixelPerfect: e.target.checked })}
          />
          Pixel perfect
        </label>
      )}

      {isShape && (
        <label>
          <input
            type="checkbox"
            checked={s.shapeFilled}
            onChange={(e) => editor.setOption({ shapeFilled: e.target.checked })}
          />
          Filled
        </label>
      )}

      {s.tool === 'fill' && (
        <label>
          <input
            type="checkbox"
            checked={s.fillContiguous}
            onChange={(e) => editor.setOption({ fillContiguous: e.target.checked })}
          />
          Contiguous
        </label>
      )}

      {s.tool === 'wand' && (
        <label title="Only select pixels connected to the one you click">
          <input
            type="checkbox"
            checked={s.wandContiguous}
            onChange={(e) => editor.setOption({ wandContiguous: e.target.checked })}
          />
          Contiguous
        </label>
      )}

      {DITHER_TOOLS.includes(s.tool) && (
        <label title="Paint through an ordered dither pattern">
          Dither
          <select
            className="text-input"
            style={{ height: 24, width: 74, padding: '0 4px' }}
            value={s.dither}
            onChange={(e) => editor.setOption({ dither: +e.target.value })}
          >
            {DITHER_OPTIONS.map(([label, level]) => (
              <option key={level} value={level}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      {usesBrush && (
        <>
          <span className="sep" />
          <span>Symmetry</span>
          <label>
            <input
              type="checkbox"
              checked={s.mirrorX}
              onChange={(e) => editor.setOption({ mirrorX: e.target.checked })}
            />
            Horizontal
          </label>
          <label>
            <input
              type="checkbox"
              checked={s.mirrorY}
              onChange={(e) => editor.setOption({ mirrorY: e.target.checked })}
            />
            Vertical
          </label>
        </>
      )}

      <span className="hint" style={{ marginLeft: 'auto' }}>
        {hint ?? 'Right click paints with the secondary color · Alt picks a color'}
      </span>
    </div>
  );
}
