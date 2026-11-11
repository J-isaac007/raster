import { useState } from 'react';
import { TextInput } from '../components';

/** A name that turns into a text field on double-click (layer and group rows). */
export function EditableName({
  name,
  onRename,
  className = 'layer-name',
}: {
  name: string;
  onRename(name: string): void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    else setDraft(name);
  };
  if (editing) {
    return (
      <TextInput
        compact
        className="layer-name-input"
        autoFocus
        data-own-escape
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(name);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <span
      className={className}
      title="Double-click to rename"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraft(name);
        setEditing(true);
      }}
    >
      {name}
    </span>
  );
}
