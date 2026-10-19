import { brushOrigin, brushPixelColor } from '../core/brush';
import { useEffect, useRef } from 'react';
import { selectionOutline, type Edge } from '../core/mask';
import { selectionContains, type Selection } from '../core/raster';
import { composite } from '../core/sprite';
import { useEditor } from '../editor/context';
import { TOOL_BY_ID, type Tool } from '../editor/tools';

const CHECKER_SIZE = 8;
const ONION_ALPHA = 0.32;
/** Previous frames tint warm, next frames tint cool. */
const ONION_TINTS = { prev: [255, 77, 106], next: [77, 140, 255] } as const;

/** Writes a tinted, faded copy of `src` into `out` for onion skinning. */
function tintInto(src: Uint32Array, out: Uint32Array, [tr, tg, tb]: readonly number[]): void {
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const a = c >>> 24;
    if (a === 0) {
      out[i] = 0;
      continue;
    }
    const r = ((c & 255) + tr) >> 1;
    const g = (((c >>> 8) & 255) + tg) >> 1;
    const b = (((c >>> 16) & 255) + tb) >> 1;
    out[i] = ((Math.round(a * ONION_ALPHA) << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
}
const WHEEL_STEP = 60;
/** Marching ants advance one device pixel per this many milliseconds. */
const ANTS_MS = 60;
const SELECTION_TOOLS = new Set(['select', 'lasso', 'wand']);

function makeChecker(ctx: CanvasRenderingContext2D, dpr: number): CanvasPattern {
  const cell = Math.round(CHECKER_SIZE * dpr);
  const tile = document.createElement('canvas');
  tile.width = tile.height = cell * 2;
  const t = tile.getContext('2d')!;
  t.fillStyle = '#f4f5f8';
  t.fillRect(0, 0, cell * 2, cell * 2);
  t.fillStyle = '#d4d6de';
  t.fillRect(cell, 0, cell, cell);
  t.fillRect(0, cell, cell, cell);
  return ctx.createPattern(tile, 'repeat')!;
}

const modifiers = (e: PointerEvent) => ({ shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });

type Gesture =
  | { kind: 'pan'; pointerId: number; lastX: number; lastY: number }
  | { kind: 'tool'; pointerId: number; tool: Tool; button: number };

/**
 * The drawing surface. Rendering runs outside React: it subscribes to the
 * editor directly and repaints on the next animation frame after any change.
 */
export function CanvasView() {
  const editor = useEditor();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const buffer = document.createElement('canvas');
    const bctx = buffer.getContext('2d')!;
    let image: ImageData | null = null;
    let image32 = new Uint32Array(0);
    let lastRevision = -1;
    const onion = document.createElement('canvas');
    const octx = onion.getContext('2d')!;
    let onionKey = '';
    const reference = document.createElement('canvas');
    let referenceSource: unknown = null;
    let dpr = window.devicePixelRatio || 1;
    let checker = makeChecker(ctx, dpr);
    let frame = 0;
    let gesture: Gesture | null = null;
    let wheelAccum = 0;
    let fitted = false;
    let antsTimer = 0;
    /** Outline of the last drawn selection; recomputed when it changes. */
    let outline: { selection: Selection | null; edges: Edge[] } = { selection: null, edges: [] };

    // Cached rendering of the custom brush for the cursor preview.
    const brushCanvas = document.createElement('canvas');
    let brushSource: unknown = null;
    let brushModeShown = '';
    let brushColorShown = -1;

    const draw = () => {
      frame = 0;
      const s = editor.getState();
      const { width: vw, height: vh } = editor.viewport;

      if (buffer.width !== s.width || buffer.height !== s.height || !image) {
        buffer.width = s.width;
        buffer.height = s.height;
        image = bctx.createImageData(s.width, s.height);
        image32 = new Uint32Array(image.data.buffer);
        lastRevision = -1;
      }
      if (lastRevision !== s.revision) {
        composite(editor.sprite, image32);
        bctx.putImageData(image, 0, 0);
        lastRevision = s.revision;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Work in device pixels so lines stay crisp at any zoom.
      const z = s.zoom * dpr;
      const ox = Math.round(s.panX * dpr);
      const oy = Math.round(s.panY * dpr);
      const w = Math.round(s.width * z);
      const h = Math.round(s.height * z);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(ox + 3 * dpr, oy + 3 * dpr, w, h);
      ctx.fillStyle = checker;
      ctx.fillRect(ox, oy, w, h);
      ctx.imageSmoothingEnabled = false;

      // Reference image, fitted inside the canvas and kept to its aspect ratio.
      const ref = editor.referenceImage;
      const refOn = ref && s.reference?.visible;
      if (ref && ref !== referenceSource) {
        referenceSource = ref;
        reference.width = ref.width;
        reference.height = ref.height;
        const img = new ImageData(ref.width, ref.height);
        img.data.set(
          new Uint8ClampedArray(ref.pixels.buffer, ref.pixels.byteOffset, ref.pixels.byteLength),
        );
        reference.getContext('2d')!.putImageData(img, 0, 0);
      }
      const drawReference = () => {
        if (!ref || !refOn) return;
        const k = Math.min(w / ref.width, h / ref.height);
        const rw = ref.width * k;
        const rh = ref.height * k;
        ctx.save();
        ctx.globalAlpha = s.reference!.opacity;
        ctx.imageSmoothingEnabled = k < 1;
        ctx.drawImage(reference, ox + (w - rw) / 2, oy + (h - rh) / 2, rw, rh);
        ctx.restore();
      };
      if (!s.reference?.above) drawReference();

      // Onion skin: neighbors of the current frame, behind it.
      const showOnion = s.onionSkin && !s.playing && s.frames.length > 1;
      if (showOnion) {
        const key = `${s.revision}:${s.frame}:${s.width}x${s.height}:${s.frames.length}`;
        if (key !== onionKey) {
          onionKey = key;
          onion.width = s.width;
          onion.height = s.height * 2;
          const img = octx.createImageData(s.width, s.height * 2);
          const out = new Uint32Array(img.data.buffer);
          const size = s.width * s.height;
          if (s.frame > 0) {
            tintInto(editor.flattenFrame(s.frame - 1), out.subarray(0, size), ONION_TINTS.prev);
          }
          if (s.frame < s.frames.length - 1) {
            tintInto(editor.flattenFrame(s.frame + 1), out.subarray(size), ONION_TINTS.next);
          }
          octx.putImageData(img, 0, 0);
        }
        ctx.drawImage(onion, 0, 0, s.width, s.height, ox, oy, w, h);
        ctx.drawImage(onion, 0, s.height, s.width, s.height, ox, oy, w, h);
      }
      ctx.drawImage(buffer, ox, oy, w, h);
      if (s.reference?.above) drawReference();

      // Tile mode: repeat the art around the canvas, dimmed, to check seams.
      if (s.tileMode !== 'off') {
        const xs = s.tileMode === 'y' ? [0] : [-1, 0, 1];
        const ys = s.tileMode === 'x' ? [0] : [-1, 0, 1];
        for (const dy of ys) {
          for (const dx of xs) {
            if (!dx && !dy) continue;
            const tx = ox + dx * w;
            const ty = oy + dy * h;
            ctx.fillStyle = checker;
            ctx.fillRect(tx, ty, w, h);
            ctx.drawImage(buffer, tx, ty, w, h);
            ctx.fillStyle = 'rgba(16, 17, 21, 0.4)';
            ctx.fillRect(tx, ty, w, h);
          }
        }
      }

      const x0 = Math.max(0, Math.floor(-ox / z));
      const x1 = Math.min(s.width, Math.ceil((vw * dpr - ox) / z));
      const y0 = Math.max(0, Math.floor(-oy / z));
      const y1 = Math.min(s.height, Math.ceil((vh * dpr - oy) / z));

      if (s.showGrid && s.zoom >= 6) {
        ctx.beginPath();
        for (let x = x0; x <= x1; x++) {
          const px = Math.round(ox + x * z) + 0.5;
          ctx.moveTo(px, oy + y0 * z);
          ctx.lineTo(px, oy + y1 * z);
        }
        for (let y = y0; y <= y1; y++) {
          const py = Math.round(oy + y * z) + 0.5;
          ctx.moveTo(ox + x0 * z, py);
          ctx.lineTo(ox + x1 * z, py);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(80, 84, 100, 0.35)';
        ctx.stroke();
      }

      if (s.showTileGrid) {
        const { width: tw, height: th } = s.tileGrid;
        ctx.beginPath();
        for (let x = 0; x <= s.width; x += tw) {
          const px = Math.round(ox + x * z) + 0.5;
          ctx.moveTo(px, oy);
          ctx.lineTo(px, oy + h);
        }
        for (let y = 0; y <= s.height; y += th) {
          const py = Math.round(oy + y * z) + 0.5;
          ctx.moveTo(ox, py);
          ctx.lineTo(ox + w, py);
        }
        ctx.lineWidth = Math.max(1, Math.floor(dpr));
        ctx.strokeStyle = 'rgba(91, 140, 255, 0.55)';
        ctx.stroke();
      }

      if (s.mirrorX || s.mirrorY) {
        ctx.save();
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.strokeStyle = 'rgba(91, 140, 255, 0.85)';
        ctx.lineWidth = Math.max(1, dpr);
        ctx.beginPath();
        if (s.mirrorX) {
          const px = Math.round(ox + (s.width / 2) * z) + 0.5;
          ctx.moveTo(px, oy);
          ctx.lineTo(px, oy + h);
        }
        if (s.mirrorY) {
          const py = Math.round(oy + (s.height / 2) * z) + 0.5;
          ctx.moveTo(ox, py);
          ctx.lineTo(ox + w, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Marching ants around the selection.
      if (s.selection) {
        if (outline.selection !== s.selection) {
          outline = { selection: s.selection, edges: selectionOutline(s.selection) };
        }
        // Edges sit on pixel boundaries; nudge the far ones inside so the
        // outline lines up with the art at every zoom.
        const ex = (x: number) => Math.round(ox + x * z) + (x === s.selection!.x ? 0.5 : -0.5);
        const ey = (y: number) => Math.round(oy + y * z) + (y === s.selection!.y ? 0.5 : -0.5);
        ctx.beginPath();
        for (const [x0, y0, x1, y1] of outline.edges) {
          ctx.moveTo(ex(x0), ey(y0));
          ctx.lineTo(ex(x1), ey(y1));
        }
        const dash = 4 * dpr;
        ctx.save();
        ctx.lineWidth = Math.max(1, Math.floor(dpr));
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.setLineDash([dash, dash]);
        ctx.lineDashOffset = -((performance.now() / ANTS_MS) % (dash * 2));
        ctx.strokeStyle = '#000';
        ctx.stroke();
        ctx.restore();
        if (!antsTimer) {
          antsTimer = window.setTimeout(() => {
            antsTimer = 0;
            schedule();
          }, ANTS_MS * 2);
        }
      }

      const hoverSelection =
        SELECTION_TOOLS.has(s.tool) &&
        s.cursor &&
        s.selection &&
        selectionContains(s.selection, s.cursor.x, s.cursor.y);

      // Brush footprint under the cursor.
      if (s.cursor && !s.panning && gesture?.kind !== 'pan' && !SELECTION_TOOLS.has(s.tool)) {
        const pointTool = s.tool === 'fill' || s.tool === 'picker';
        const custom = pointTool ? null : s.customBrush;
        const bw = custom ? custom.width : pointTool ? 1 : s.brushSize;
        const bh = custom ? custom.height : bw;
        const [sx, sy] = custom
          ? brushOrigin(custom)
          : [Math.floor((bw - 1) / 2), Math.floor((bh - 1) / 2)];
        const left = ox + (s.cursor.x - sx) * z;
        const top = oy + (s.cursor.y - sy) * z;
        if (custom && s.tool !== 'eraser' && s.tool !== 'shade') {
          // Ghost of the brush, in its own colors or in the current color.
          if (
            custom !== brushSource ||
            s.brushMode !== brushModeShown ||
            s.primary !== brushColorShown
          ) {
            brushSource = custom;
            brushModeShown = s.brushMode;
            brushColorShown = s.primary;
            brushCanvas.width = custom.width;
            brushCanvas.height = custom.height;
            const img = new ImageData(custom.width, custom.height);
            const out = new Uint32Array(img.data.buffer);
            custom.pixels.forEach((c, i) => {
              out[i] = c >>> 24 === 0 ? 0 : brushPixelColor(s.brushMode, c, s.primary);
            });
            brushCanvas.getContext('2d')!.putImageData(img, 0, 0);
          }
          ctx.save();
          ctx.globalAlpha = 0.6;
          ctx.drawImage(brushCanvas, left, top, custom.width * z, custom.height * z);
          ctx.restore();
        }
        const bx = Math.round(left) + 0.5;
        const by = Math.round(top) + 0.5;
        const bws = Math.round(bw * z) - 1;
        const bhs = Math.round(bh * z) - 1;
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.strokeRect(bx - 1, by - 1, bws + 2, bhs + 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeRect(bx, by, bws, bhs);
      }

      canvas.style.cursor =
        gesture?.kind === 'pan'
          ? 'grabbing'
          : s.panning
            ? 'grab'
            : hoverSelection
              ? 'move'
              : 'crosshair';
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const nextDpr = window.devicePixelRatio || 1;
      if (nextDpr !== dpr) {
        dpr = nextDpr;
        checker = makeChecker(ctx, dpr);
      }
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      editor.setViewport(rect.width, rect.height);
      if (!fitted && rect.width > 0) {
        fitted = true;
        editor.zoomToFit();
      }
      schedule();
    };

    const locate = (e: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      const s = editor.getState();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return {
        sx,
        sy,
        x: Math.floor((sx - s.panX) / s.zoom),
        y: Math.floor((sy - s.panY) / s.zoom),
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (gesture) return;
      const p = locate(e);
      canvas.setPointerCapture(e.pointerId);
      if (e.button === 1 || (e.button === 0 && editor.getState().panning)) {
        gesture = { kind: 'pan', pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
        schedule();
        return;
      }
      if (e.button !== 0 && e.button !== 2) return;
      const tool = e.altKey ? TOOL_BY_ID.picker : TOOL_BY_ID[editor.getState().tool];
      gesture = { kind: 'tool', pointerId: e.pointerId, tool, button: e.button };
      tool.down(editor, { x: p.x, y: p.y, button: e.button, ...modifiers(e) });
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = locate(e);
      editor.setCursor({ x: p.x, y: p.y });
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      if (gesture.kind === 'pan') {
        const s = editor.getState();
        editor.setPan(s.panX + e.clientX - gesture.lastX, s.panY + e.clientY - gesture.lastY);
        gesture.lastX = e.clientX;
        gesture.lastY = e.clientY;
      } else {
        gesture.tool.move(editor, { x: p.x, y: p.y, button: gesture.button, ...modifiers(e) });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      if (gesture.kind === 'tool') {
        const p = locate(e);
        gesture.tool.up(editor, { x: p.x, y: p.y, button: gesture.button, ...modifiers(e) });
      }
      gesture = null;
      schedule();
    };

    const onPointerLeave = () => {
      if (!gesture) editor.setCursor(null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey && !e.ctrlKey) {
        const s = editor.getState();
        editor.setPan(s.panX - (e.deltaY || e.deltaX), s.panY);
        return;
      }
      const delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
      wheelAccum += delta;
      if (Math.abs(wheelAccum) < WHEEL_STEP) return;
      const p = locate(e);
      editor.zoomStep(wheelAccum < 0 ? 1 : -1, p.sx, p.sy);
      wheelAccum = 0;
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const unsubscribe = editor.subscribe(schedule);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    resize();

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(antsTimer);
      observer.disconnect();
      unsubscribe();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, [editor]);

  return (
    <div className="viewport" ref={hostRef}>
      <canvas ref={canvasRef} aria-label="Sprite canvas" />
    </div>
  );
}
