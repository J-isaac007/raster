import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers2,
  Link,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Tag as TagIcon,
  Trash,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { celLinks } from '@core/sprite';
import { Chip, IconButton, TextInput } from '../components';
import { TagDialog } from '../dialogs';
import { useEditor, useEditorState } from '../editorContext';

const THUMB = 44;
/** Frame cell width plus the gap between cells (see `.frame` in styles/timeline.css). */
const FRAME_STRIDE = 58;
/** Tag colors cycle through the --tag-N tokens. */
const TAG_COLOR_COUNT = 6;

function FrameThumb({ index }: { index: number }) {
  const editor = useEditor();
  const ref = useRef<HTMLCanvasElement>(null);
  const { revision, width, height, playing } = useEditorState((s) => ({
    revision: s.revision,
    width: s.width,
    height: s.height,
    playing: s.playing,
  }));

  useEffect(() => {
    // Thumbnails are cosmetic: skip them while playing and throttle while drawing.
    if (playing) return;
    const timer = setTimeout(() => {
      const canvas = ref.current;
      if (!canvas || index >= editor.frameCount) return;
      canvas.width = width;
      canvas.height = height;
      const img = new ImageData(width, height);
      const flat = editor.flattenFrame(index);
      img.data.set(new Uint8ClampedArray(flat.buffer, flat.byteOffset, flat.byteLength));
      canvas.getContext('2d')!.putImageData(img, 0, 0);
    }, 150);
    return () => clearTimeout(timer);
  }, [editor, index, revision, width, height, playing]);

  const aspect = width / height;
  return (
    <canvas
      ref={ref}
      className="frame-thumb canvas-bg"
      style={{
        width: aspect >= 1 ? THUMB : THUMB * aspect,
        height: aspect >= 1 ? THUMB / aspect : THUMB,
      }}
    />
  );
}

function DurationField() {
  const editor = useEditor();
  const { frame, duration } = useEditorState((s) => ({
    frame: s.frame,
    duration: s.frames[s.frame],
  }));
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) editor.setFrameDuration(frame, Number(draft));
    editor.sealHistory();
    setDraft(null);
  };
  return (
    <div className="duration">
      <TextInput
        mono
        compact
        type="number"
        aria-label="Frame duration in milliseconds"
        title="How long this frame shows, in milliseconds"
        min={10}
        max={60000}
        step={10}
        value={draft ?? duration}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="hint">ms</span>
      <Chip
        title="Use this duration for every frame"
        onClick={() => editor.setAllFrameDurations(Number(draft ?? duration))}
      >
        Set all
      </Chip>
    </div>
  );
}

/** Plays the animation by stepping frames on a timer while `playing` is set. */
function usePlayback() {
  const editor = useEditor();
  const playing = useEditorState((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const { frame, frames } = editor.getState();
      timer = setTimeout(() => {
        editor.advancePlayback();
        tick();
      }, frames[frame]);
    };
    tick();
    return () => clearTimeout(timer);
  }, [editor, playing]);
}

export function Timeline() {
  const editor = useEditor();
  const { frame, frames, tags, playing, onionSkin } = useEditorState((s) => ({
    frame: s.frame,
    frames: s.frames,
    tags: s.tags,
    playing: s.playing,
    onionSkin: s.onionSkin,
  }));
  // Frames whose cel (on the active layer) is shared with another frame.
  const links = useEditorState(() => celLinks(editor.activeLayer.cels));
  const [editingTag, setEditingTag] = useState<number | 'new' | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  usePlayback();
  const linked = (i: number) => links[i] !== i || links.indexOf(i, i + 1) > 0;

  useEffect(() => {
    const el = stripRef.current?.children[frame] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [frame]);

  const total = frames.reduce((a, b) => a + b, 0);
  const many = frames.length > 1;

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline-controls">
        <IconButton
          icon={SkipBack}
          label="First frame"
          disabled={!many}
          onClick={() => editor.setFrame(0)}
        />
        <IconButton
          icon={ChevronLeft}
          label="Previous frame"
          shortcut="←"
          disabled={!many}
          onClick={() => editor.prevFrame()}
        />
        <IconButton
          icon={playing ? Pause : Play}
          label={playing ? 'Pause' : 'Play'}
          shortcut="Enter"
          pressed={playing}
          disabled={!many}
          onClick={() => editor.setPlaying(!playing)}
        />
        <IconButton
          icon={ChevronRight}
          label="Next frame"
          shortcut="→"
          disabled={!many}
          onClick={() => editor.nextFrame()}
        />
        <IconButton
          icon={SkipForward}
          label="Last frame"
          disabled={!many}
          onClick={() => editor.setFrame(frames.length - 1)}
        />

        <span className="divider" />

        <IconButton
          icon={Plus}
          label="New frame"
          shortcut="Alt+N"
          onClick={() => editor.addFrame()}
        />
        <IconButton
          icon={Copy}
          label="Duplicate frame"
          shortcut="Alt+D"
          onClick={() => editor.duplicateFrame()}
        />
        <IconButton
          icon={Trash}
          label="Delete frame"
          disabled={!many}
          onClick={() => editor.deleteFrame()}
        />
        <IconButton
          icon={TagIcon}
          label="New tag"
          shortcut="Alt+T"
          onClick={() => setEditingTag('new')}
        />
        <IconButton
          icon={Layers2}
          label="Onion skin"
          shortcut="Shift+O"
          pressed={onionSkin}
          onClick={() => editor.setOnionSkin(!onionSkin)}
        />

        <span className="divider" />
        <DurationField />

        <span className="timeline-info mono">
          Frame {frame + 1} / {frames.length} · {(total / 1000).toFixed(2)} s
        </span>
      </div>

      <div className="frames">
        {tags.length > 0 && (
          <div className="tag-row" style={{ width: frames.length * FRAME_STRIDE }}>
            {tags.map((t, i) => (
              <button
                key={i}
                className="tag"
                title={`${t.name} · frames ${t.from + 1}–${t.to + 1} (click to edit)`}
                style={
                  {
                    '--tag': `var(--tag-${(i % TAG_COLOR_COUNT) + 1})`,
                    left: t.from * FRAME_STRIDE,
                    width: (t.to - t.from + 1) * FRAME_STRIDE - 6,
                  } as CSSProperties
                }
                onClick={() => setEditingTag(i)}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        <div className="frame-row" ref={stripRef} role="listbox" aria-label="Frames">
          {frames.map((ms, i) => (
            <button
              key={i}
              className="frame"
              role="option"
              aria-selected={i === frame}
              title={`Frame ${i + 1} · ${ms} ms${linked(i) ? ' · linked cel' : ''}`}
              onClick={() => editor.setFrame(i)}
            >
              <FrameThumb index={i} />
              {linked(i) && (
                <span className="frame-link" aria-label="Linked cel">
                  <Link size={10} />
                </span>
              )}
              <span className="frame-label">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>
      {editingTag !== null && (
        <TagDialog
          index={editingTag === 'new' ? null : editingTag}
          onClose={() => setEditingTag(null)}
        />
      )}
    </section>
  );
}
