import { useState } from 'react';
import { MAX_TAG_NAME } from '@core/tags';
import { Button, TextInput } from '../components';
import { useEditor } from '../editorContext';
import { Dialog, DialogActions, DialogNote } from './Dialog';

/** Creates a tag (`index` null) or edits one. Frames show 1-based. */
export function TagDialog({ index, onClose }: { index: number | null; onClose: () => void }) {
  const editor = useEditor();
  const s = editor.getState();
  const existing = index === null ? null : s.tags[index];
  const [name, setName] = useState(existing?.name ?? `Tag ${s.tags.length + 1}`);
  const [from, setFrom] = useState((existing?.from ?? s.frame) + 1);
  const [to, setTo] = useState((existing?.to ?? s.frame) + 1);
  const count = s.frames.length;

  const save = () => {
    const tag = { name, from: from - 1, to: to - 1 };
    if (index === null) editor.addTag(tag);
    else editor.updateTag(index, tag);
    onClose();
  };

  return (
    <Dialog title={index === null ? 'New Tag' : 'Edit Tag'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="form-grid">
          <label htmlFor="tag-name">Name</label>
          <TextInput
            id="tag-name"
            maxLength={MAX_TAG_NAME}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label htmlFor="tag-from">From frame</label>
          <TextInput
            id="tag-from"
            type="number"
            min={1}
            max={count}
            value={from}
            onChange={(e) => setFrom(+e.target.value)}
          />
          <label htmlFor="tag-to">To frame</label>
          <TextInput
            id="tag-to"
            type="number"
            min={1}
            max={count}
            value={to}
            onChange={(e) => setTo(+e.target.value)}
          />
        </div>
        <DialogNote>
          Playback loops inside the tag of the frame it starts on. Tags are saved with the project
          and exported with sprite sheets.
        </DialogNote>
        <DialogActions>
          {index !== null && (
            <>
              <Button
                variant="danger"
                onClick={() => {
                  editor.deleteTag(index);
                  onClose();
                }}
              >
                Delete
              </Button>
              <span className="spacer" />
            </>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            {index === null ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
