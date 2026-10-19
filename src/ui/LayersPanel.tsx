import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Merge,
  Plus,
  Trash,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState } from '../editor/context';
import type { LayerInfo } from '../editor/editor';

function LayerThumb({ layerId }: { layerId: string }) {
  const editor = useEditor();
  const ref = useRef<HTMLCanvasElement>(null);
  const revision = useEditorState((s) => s.revision);
  const size = useEditorState((s) => ({ w: s.width, h: s.height }));

  useEffect(() => {
    // Thumbnails are cosmetic; throttle so long strokes stay smooth.
    const timer = setTimeout(() => {
      const canvas = ref.current;
      const layer = editor.sprite.layers.find((l) => l.id === layerId);
      if (!canvas || !layer) return;
      canvas.width = layer.width;
      canvas.height = layer.height;
      const img = new ImageData(
        new Uint8ClampedArray(layer.pixels.slice().buffer),
        layer.width,
        layer.height,
      );
      canvas.getContext('2d')!.putImageData(img, 0, 0);
    }, 120);
    return () => clearTimeout(timer);
  }, [editor, layerId, revision, size.w, size.h]);

  const aspect = size.w / size.h;
  return (
    <canvas
      ref={ref}
      className="layer-thumb checker"
      style={{
        objectFit: 'contain',
        width: aspect >= 1 ? 30 : 30 * aspect,
        height: aspect >= 1 ? 30 / aspect : 30,
      }}
    />
  );
}

function LayerRow({ layer, active }: { layer: LayerInfo; active: boolean }) {
  const editor = useEditor();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(layer.name);

  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== layer.name) editor.updateLayer(layer.id, { name });
    else setDraft(layer.name);
  };

  return (
    <div
      className={`layer${layer.visible ? '' : ' hidden'}`}
      role="option"
      aria-selected={active}
      onClick={() => editor.setActiveLayer(layer.id)}
      onDoubleClick={() => {
        setDraft(layer.name);
        setEditing(true);
      }}
    >
      <button
        className="icon-btn"
        title={layer.visible ? 'Hide layer' : 'Show layer'}
        aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
        onClick={(e) => {
          e.stopPropagation();
          editor.updateLayer(layer.id, { visible: !layer.visible });
        }}
      >
        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <LayerThumb layerId={layer.id} />
      {editing ? (
        <input
          className="text-input layer-name-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(layer.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span className="layer-name" title="Double-click to rename">
          {layer.name}
        </span>
      )}
      <button
        className="icon-btn"
        title={layer.locked ? 'Unlock layer' : 'Lock layer'}
        aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
        aria-pressed={layer.locked}
        onClick={(e) => {
          e.stopPropagation();
          editor.updateLayer(layer.id, { locked: !layer.locked });
        }}
      >
        {layer.locked ? <Lock size={13} /> : <LockOpen size={13} style={{ opacity: 0.4 }} />}
      </button>
    </div>
  );
}

export function LayersPanel() {
  const editor = useEditor();
  const { layers, activeLayerId } = useEditorState((s) => ({
    layers: s.layers,
    activeLayerId: s.activeLayerId,
  }));
  const index = layers.findIndex((l) => l.id === activeLayerId);
  const active = layers[index];

  return (
    <section className="panel grow" aria-label="Layers">
      <div className="panel-head">
        <span className="panel-title">Layers</span>
        <div className="icon-row">
          <button
            className="icon-btn"
            title="New layer (Shift+N)"
            aria-label="New layer"
            onClick={() => editor.addLayer()}
          >
            <Plus size={14} />
          </button>
          <button
            className="icon-btn"
            title="Duplicate layer"
            aria-label="Duplicate layer"
            onClick={() => editor.duplicateLayer()}
          >
            <Copy size={13} />
          </button>
          <button
            className="icon-btn"
            title="Move layer up"
            aria-label="Move layer up"
            disabled={index >= layers.length - 1}
            onClick={() => editor.moveLayer(activeLayerId, 1)}
          >
            <ChevronUp size={14} />
          </button>
          <button
            className="icon-btn"
            title="Move layer down"
            aria-label="Move layer down"
            disabled={index <= 0}
            onClick={() => editor.moveLayer(activeLayerId, -1)}
          >
            <ChevronDown size={14} />
          </button>
          <button
            className="icon-btn"
            title="Merge down"
            aria-label="Merge down"
            disabled={index <= 0}
            onClick={() => editor.mergeDown()}
          >
            <Merge size={13} />
          </button>
          <button
            className="icon-btn"
            title="Delete layer"
            aria-label="Delete layer"
            disabled={layers.length <= 1}
            onClick={() => editor.deleteLayer()}
          >
            <Trash size={13} />
          </button>
        </div>
      </div>

      <div className="layers" role="listbox" aria-label="Layer list">
        {[...layers].reverse().map((layer) => (
          <LayerRow key={layer.id} layer={layer} active={layer.id === activeLayerId} />
        ))}
      </div>

      {active && (
        <label className="layer-opacity">
          Opacity
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(active.opacity * 100)}
            onChange={(e) => editor.updateLayer(active.id, { opacity: +e.target.value / 100 })}
            onPointerUp={() => editor.sealHistory()}
            onKeyUp={() => editor.sealHistory()}
          />
          <span className="range-label">{Math.round(active.opacity * 100)}%</span>
        </label>
      )}
    </section>
  );
}
