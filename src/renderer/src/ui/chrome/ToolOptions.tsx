import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DITHER_LEVELS, type CustomBrush } from '@core/brush';
import {
  MAX_BRUSH,
  MAX_POLYGON_SIDES,
  MAX_SHAPE_RADIUS,
  MIN_POLYGON_SIDES,
  type ToolId,
} from '@editor/editor';
import { TOOL_BY_ID } from '@editor/tools';
import { Checkbox, Chip, IconButton, Select, Slider } from '../components';
import { useEditor, useEditorState } from '../editorContext';
import { TransformOptions } from './TransformOptions';

const BRUSH_TOOLS: ToolId[] = ['pencil', 'eraser', 'shade', 'line', 'rect', 'ellipse', 'polygon'];
const DITHER_TOOLS: ToolId[] = ['pencil', 'line', 'rect', 'ellipse', 'polygon', 'fill'];
const SHAPE_TOOLS: ToolId[] = ['rect', 'ellipse', 'polygon'];
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
    shapeRadius: s.shapeRadius,
    polygonSides: s.polygonSides,
    gradientKind: s.gradientKind,
    fillContiguous: s.fillContiguous,
    wandContiguous: s.wandContiguous,
    mirrorX: s.mirrorX,
    mirrorY: s.mirrorY,
    pixelPerfect: s.pixelPerfect,
    dither: s.dither,
    customBrush: s.customBrush,
    brushMode: s.brushMode,
    transform: s.transform,
  }));
  const usesBrush = BRUSH_TOOLS.includes(s.tool);
  const isShape = SHAPE_TOOLS.includes(s.tool);

  if (s.transform) {
    return (
      <div className="options" role="toolbar" aria-label="Transform options">
        <span className="tool-name">Transform</span>
        <TransformOptions transform={s.transform} />
      </div>
    );
  }

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

      {s.tool === 'rect' && (
        <Slider
          className="shape-radius"
          label="Radius"
          title="Corner radius (0 for square corners)"
          min={0}
          max={MAX_SHAPE_RADIUS}
          value={s.shapeRadius}
          display={`${s.shapeRadius} px`}
          onChange={(shapeRadius) => editor.setOption({ shapeRadius })}
        />
      )}

      {s.tool === 'polygon' && (
        <Slider
          className="polygon-sides"
          label="Sides"
          title="Number of sides"
          min={MIN_POLYGON_SIDES}
          max={MAX_POLYGON_SIDES}
          value={s.polygonSides}
          display={`${s.polygonSides}`}
          onChange={(polygonSides) => editor.setOption({ polygonSides })}
        />
      )}

      {s.tool === 'gradient' && (
        <div className="option-field" role="group" aria-label="Gradient type">
          <span className="option-label">Type</span>
          <Chip
            pressed={s.gradientKind === 'linear'}
            onClick={() => editor.setOption({ gradientKind: 'linear' })}
          >
            Linear
          </Chip>
          <Chip
            pressed={s.gradientKind === 'radial'}
            onClick={() => editor.setOption({ gradientKind: 'radial' })}
          >
            Radial
          </Chip>
        </div>
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
