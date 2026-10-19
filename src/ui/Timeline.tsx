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
import { useEffect, useRef, useState } from 'react';
import { celLinks } from '../core/sprite';
import { useEditor, useEditorState } from '../editor/context';
import { TagDialog } from './Dialogs';

const THUMB = 44;
/** Frame button width plus the gap between frames (see `.frame` in styles.css). */
const FRAME_STRIDE = 60;
const TAG_COLORS = ['#5b8cff', '#ff9f43', '#2ed47a', '#e056fd', '#ff6b7a', '#00d2d3'];

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
      className="frame-thumb checker"
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
    <label className="duration" title="How long this frame shows, in milliseconds">
      <input
        className="text-input mono"
        type="number"
        min={10}
        max={60000}
        step={10}
        value={draft ?? duration}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      ms
      <button
        className="chip"
        title="Use this duration for every frame"
        onClick={() => editor.setAllFrameDurations(Number(draft ?? duration))}
      >
        All
      </button>
    </label>
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
        <div className="icon-row">
          <button
            className="icon-btn"
            title="First frame"
            aria-label="First frame"
            disabled={!many}
            onClick={() => editor.setFrame(0)}
          >
            <SkipBack size={14} />
          </button>
          <button
            className="icon-btn"
            title="Previous frame (←)"
            aria-label="Previous frame"
            disabled={!many}
            onClick={() => editor.prevFrame()}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            className="icon-btn play"
            title={playing ? 'Pause (Enter)' : 'Play (Enter)'}
            aria-label={playing ? 'Pause' : 'Play'}
            aria-pressed={playing}
            disabled={!many}
            onClick={() => editor.setPlaying(!playing)}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            className="icon-btn"
            title="Next frame (→)"
            aria-label="Next frame"
            disabled={!many}
            onClick={() => editor.nextFrame()}
          >
            <ChevronRight size={15} />
          </button>
          <button
            className="icon-btn"
            title="Last frame"
            aria-label="Last frame"
            disabled={!many}
            onClick={() => editor.setFrame(frames.length - 1)}
          >
            <SkipForward size={14} />
          </button>
        </div>

        <span className="sep" />

        <div className="icon-row">
          <button
            className="icon-btn"
            title="New frame (Alt+N)"
            aria-label="New frame"
            onClick={() => editor.addFrame()}
          >
            <Plus size={14} />
          </button>
          <button
            className="icon-btn"
            title="Duplicate frame (Alt+D)"
            aria-label="Duplicate frame"
            onClick={() => editor.duplicateFrame()}
          >
            <Copy size={13} />
          </button>
          <button
            className="icon-btn"
            title="Delete frame"
            aria-label="Delete frame"
            disabled={!many}
            onClick={() => editor.deleteFrame()}
          >
            <Trash size={13} />
          </button>
          <button
            className="icon-btn"
            title="New tag (Alt+T)"
            aria-label="New tag"
            onClick={() => setEditingTag('new')}
          >
            <TagIcon size={13} />
          </button>
          <button
            className="icon-btn"
            title="Onion skin (Shift+O)"
            aria-label="Onion skin"
            aria-pressed={onionSkin}
            onClick={() => editor.setOnionSkin(!onionSkin)}
          >
            <Layers2 size={14} />
          </button>
        </div>

        <span className="sep" />
        <DurationField />

        <span className="timeline-info">
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
                style={{
                  left: t.from * FRAME_STRIDE,
                  width: (t.to - t.from + 1) * FRAME_STRIDE - 4,
                  background: TAG_COLORS[i % TAG_COLORS.length],
                }}
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
