import {
  ChevronDown,
  ChevronUp,
  Copy,
  FolderOpen,
  FolderPlus,
  Layers,
  Merge,
  Plus,
  Trash,
} from 'lucide-react';
import { BLEND_MODE_LABELS, BLEND_MODES, type BlendMode } from '@core/color';
import { Checkbox, IconButton, PanelSection, Select, Slider } from '../components';
import { useEditor, useEditorState } from '../editorContext';

/**
 * Properties of the layer or group picked in the timeline: opacity, blend
 * mode, reference, plus the layer actions. The layer list itself is the
 * timeline's left column.
 */
export function LayersPanel() {
  const editor = useEditor();
  const { layers, groups, activeLayerId, activeGroupId } = useEditorState((s) => ({
    layers: s.layers,
    groups: s.groups,
    activeLayerId: s.activeLayerId,
    activeGroupId: s.activeGroupId,
  }));
  const index = layers.findIndex((l) => l.id === activeLayerId);
  const layer = layers[index];
  const group = activeGroupId ? groups.find((g) => g.id === activeGroupId) : undefined;
  const target = group ?? layer;
  const mergeable = !group && index > 0 && layers[index - 1].groupId === layer?.groupId;
  const setProps = (patch: { opacity?: number; blendMode?: BlendMode }) => {
    if (group) editor.updateGroup(group.id, patch);
    else if (layer) editor.updateLayer(layer.id, patch);
  };

  return (
    <PanelSection
      title="Layer"
      actions={
        <>
          <IconButton
            icon={FolderPlus}
            label={group ? 'Group this group' : 'Group layer'}
            shortcut="Ctrl+G"
            onClick={() => editor.groupLayers()}
          />
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
            disabled={!!group}
            onClick={() => editor.duplicateLayer()}
          />
          <IconButton
            icon={ChevronUp}
            label={group ? 'Move group up' : 'Move layer up'}
            onClick={() => editor.moveLayer(null, 1)}
          />
          <IconButton
            icon={ChevronDown}
            label={group ? 'Move group down' : 'Move layer down'}
            onClick={() => editor.moveLayer(null, -1)}
          />
          <IconButton
            icon={Merge}
            label="Merge down"
            shortcut="Ctrl+E"
            disabled={!mergeable}
            onClick={() => editor.mergeDown()}
          />
          <IconButton
            icon={Trash}
            label={group ? 'Delete group' : 'Delete layer'}
            disabled={layers.length <= 1}
            onClick={() => editor.deleteLayer()}
          />
        </>
      }
    >
      {target && (
        <div className="layer-props">
          <div className="layer-target">
            {group ? (
              <FolderOpen size={14} aria-hidden="true" />
            ) : (
              <Layers size={14} aria-hidden="true" />
            )}
            <span className="layer-target-name">{target.name}</span>
            {group && <span className="layer-badge">Group</span>}
          </div>
          <Slider
            label="Opacity"
            min={0}
            max={100}
            value={Math.round(target.opacity * 100)}
            display={`${Math.round(target.opacity * 100)}%`}
            onChange={(v) => setProps({ opacity: v / 100 })}
            onCommit={() => editor.sealHistory()}
          />
          <label className="layer-prop-row">
            <span className="form-label">Blend</span>
            <Select
              compact
              aria-label="Blend mode"
              value={target.blendMode}
              onChange={(e) => setProps({ blendMode: e.target.value as BlendMode })}
            >
              {BLEND_MODES.map((m) => (
                <option key={m} value={m}>
                  {group && m === 'normal' ? 'Pass through' : BLEND_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          </label>
          {!group && layer && (
            <Checkbox
              label="Reference layer (shown, not exported)"
              title="Keep this layer visible while you draw, but leave it out of every export"
              checked={layer.reference}
              onChange={(reference) => editor.updateLayer(layer.id, { reference })}
            />
          )}
        </div>
      )}
    </PanelSection>
  );
}
