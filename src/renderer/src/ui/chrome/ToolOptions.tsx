import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DITHER_LEVELS, type CustomBrush } from '@core/brush';
import { MAX_BRUSH, type ToolId } from '@editor/editor';
import { TOOL_BY_ID } from '@editor/tools';
import { Checkbox, Chip, IconButton, Select, Slider } from '../components';
import { useEditor, useEditorState } from '../editorContext';

const BRUSH_TOOLS: ToolId[] = ['pencil', 'eraser', 'shade', 'line', 'rect', 'ellipse'];
const DITHER_TOOLS: ToolId[] = ['pencil', 'line', 'rect', 'ellipse', 'fill'];
const DITHER_OPTIONS: [string, number][] = [
  ['Solid', DITHER_LEVELS],
  ['75%', 12],
  ['50%', 8],
  ['25%', 4],
  ['12%', 2],
];
const THUMB = 20;

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
  const k = THUMB / Math.max(brush.width, brush.height);
  return (
    <canvas
      ref={ref}
      className="brush-thumb canvas-bg"
      style={{ width: Math.max(1, brush.width * k), height: Math.max(1, brush.height * k) }}
      aria-hidden="true"
    />
  );
}

/** Settings for the current tool. Help text for the tool lives in the status bar. */
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

  return (
    <div className="options" role="toolbar" aria-label="Tool options">
      <span className="tool-name">{TOOL_BY_ID[s.tool].label}</span>
      <span className="divider" />

      {usesBrush && s.customBrush && (
        <div className="custom-brush" title="Custom brush (Ctrl+B makes one from a selection)">
          <BrushThumb brush={s.customBrush} />
          <span className="mono">
            {s.customBrush.width}×{s.customBrush.height}
          </span>
          {s.tool !== 'eraser' && s.tool !== 'shade' && (
            <Select
              compact
              className="brush-mode"
              aria-label="Custom brush colors"
              value={s.brushMode}
              onChange={(e) => editor.setOption({ brushMode: e.target.value as 'image' | 'color' })}
            >
              <option value="image">Brush colors</option>
              <option value="color">Current color</option>
            </Select>
          )}
          <IconButton
            icon={X}
            label="Use the square brush"
            shortcut="Ctrl+Shift+B"
            onClick={() => editor.clearCustomBrush()}
          />
        </div>
      )}

      {usesBrush && !s.customBrush && (
        <Slider
          className="brush-size"
          label="Size"
          title="Brush size ([ and ])"
          min={1}
          max={MAX_BRUSH}
          value={s.brushSize}
          display={`${s.brushSize} px`}
          onChange={(size) => editor.setBrushSize(size)}
        />
      )}

      {(s.tool === 'pencil' || s.tool === 'eraser') && (
        <Checkbox
          label="Pixel perfect"
          title="Removes L-shaped corners so freehand lines stay one pixel thin (1 px brush)"
          checked={s.pixelPerfect}
          disabled={s.brushSize !== 1 || s.customBrush !== null}
          onChange={(pixelPerfect) => editor.setOption({ pixelPerfect })}
        />
      )}

      {isShape && (
        <Checkbox
          label="Filled"
          checked={s.shapeFilled}
          onChange={(shapeFilled) => editor.setOption({ shapeFilled })}
        />
      )}

      {s.tool === 'fill' && (
        <Checkbox
          label="Contiguous"
          checked={s.fillContiguous}
          onChange={(fillContiguous) => editor.setOption({ fillContiguous })}
        />
      )}

      {s.tool === 'wand' && (
        <Checkbox
          label="Contiguous"
          title="Only select pixels connected to the one you click"
          checked={s.wandContiguous}
          onChange={(wandContiguous) => editor.setOption({ wandContiguous })}
        />
      )}

      {DITHER_TOOLS.includes(s.tool) && (
        <label className="option-field" title="Paint through an ordered dither pattern">
          <span className="option-label">Dither</span>
          <Select
            compact
            className="dither"
            value={s.dither}
            onChange={(e) => editor.setOption({ dither: +e.target.value })}
          >
            {DITHER_OPTIONS.map(([label, level]) => (
              <option key={level} value={level}>
                {label}
              </option>
            ))}
          </Select>
        </label>
      )}

      {usesBrush && (
        <>
          <span className="divider" />
          <div className="option-field" role="group" aria-label="Symmetry">
            <span className="option-label">Symmetry</span>
            <Chip pressed={s.mirrorX} onClick={() => editor.setOption({ mirrorX: !s.mirrorX })}>
              Horizontal
            </Chip>
            <Chip pressed={s.mirrorY} onClick={() => editor.setOption({ mirrorY: !s.mirrorY })}>
              Vertical
            </Chip>
          </div>
        </>
      )}
    </div>
  );
}
