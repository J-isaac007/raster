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
import type { LayerInfo } from '@editor/editor';
import { cx, IconButton, PanelSection, Slider, TextInput } from '../components';
import { useEditor, useEditorState } from '../editorContext';

const THUMB = 28;

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

  // Keeps the sprite's aspect ratio inside a THUMB × THUMB box.
  const aspect = size.w / size.h;
  return (
    <span className="layer-thumb-box">
      <canvas
        ref={ref}
        className="layer-thumb canvas-bg"
        style={{
          width: aspect >= 1 ? THUMB : THUMB * aspect,
          height: aspect >= 1 ? THUMB / aspect : THUMB,
        }}
      />
    </span>
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
      className={cx('layer', !layer.visible && 'is-hidden')}
      role="option"
      aria-selected={active}
      onClick={() => editor.setActiveLayer(layer.id)}
      onDoubleClick={() => {
        setDraft(layer.name);
        setEditing(true);
      }}
    >
      <IconButton
        icon={layer.visible ? Eye : EyeOff}
        label={layer.visible ? 'Hide layer' : 'Show layer'}
        onClick={(e) => {
          e.stopPropagation();
          editor.updateLayer(layer.id, { visible: !layer.visible });
        }}
      />
      <LayerThumb layerId={layer.id} />
      {editing ? (
        <TextInput
          compact
          className="layer-name-input"
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
      <span className="layer-opacity mono">{Math.round(layer.opacity * 100)}%</span>
      <IconButton
        icon={layer.locked ? Lock : LockOpen}
        className={cx('layer-lock', layer.locked && 'is-locked')}
        label={layer.locked ? 'Unlock layer' : 'Lock layer'}
        onClick={(e) => {
          e.stopPropagation();
          editor.updateLayer(layer.id, { locked: !layer.locked });
        }}
      />
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
    <PanelSection
      title="Layers"
      grow
      actions={
        <>
          <IconButton
            icon={Plus}
            label="New layer"
            shortcut="Shift+N"
            onClick={() => editor.addLayer()}
          />
          <IconButton
            icon={Copy}
            label="Duplicate layer"
            shortcut="Shift+D"
            onClick={() => editor.duplicateLayer()}
          />
          <IconButton
            icon={ChevronUp}
            label="Move layer up"
            disabled={index >= layers.length - 1}
            onClick={() => editor.moveLayer(activeLayerId, 1)}
          />
          <IconButton
            icon={ChevronDown}
            label="Move layer down"
            disabled={index <= 0}
            onClick={() => editor.moveLayer(activeLayerId, -1)}
          />
          <IconButton
            icon={Merge}
            label="Merge down"
            shortcut="Ctrl+E"
            disabled={index <= 0}
            onClick={() => editor.mergeDown()}
          />
          <IconButton
            icon={Trash}
            label="Delete layer"
            disabled={layers.length <= 1}
            onClick={() => editor.deleteLayer()}
          />
        </>
      }
    >
      <div className="layers" role="listbox" aria-label="Layer list">
        {[...layers].reverse().map((layer) => (
          <LayerRow key={layer.id} layer={layer} active={layer.id === activeLayerId} />
        ))}
      </div>

      {active && (
        <Slider
          label="Opacity"
          min={0}
          max={100}
          value={Math.round(active.opacity * 100)}
          display={`${Math.round(active.opacity * 100)}%`}
          onChange={(v) => editor.updateLayer(active.id, { opacity: v / 100 })}
          onCommit={() => editor.sealHistory()}
        />
      )}
    </PanelSection>
  );
}
