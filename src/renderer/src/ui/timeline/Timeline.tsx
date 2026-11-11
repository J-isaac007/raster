import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  Layers2,
  Lock,
  LockOpen,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Tag as TagIcon,
  Trash,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { celOpacity } from '@core/cels';
import { stackRows, type StackRow } from '@core/groups';
import type { GroupInfo, LayerInfo, TimelineSelection } from '@editor/editor';
import { Chip, cx, IconButton, TextInput } from '../components';
import { CelPropertiesDialog, TagDialog } from '../dialogs';
import { useEditor, useEditorState } from '../editorContext';
import { EditableName } from './EditableName';
import { OnionOptions } from './OnionOptions';

/** Grid geometry (Figma: Timeline — layers × frames grid). */
const LEFT = 220;
const CELL = 28;
const ROW = 28;
const INDENT = 14;
/** How far the pointer moves before a press on a picked range becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Dragging this close to the grid's edge scrolls it. */
const SCROLL_EDGE = 24;
/** Tag colors cycle through the --tag-N tokens. */
const TAG_COLOR_COUNT = 6;

type Row = StackRow<LayerInfo, GroupInfo>;

/**
 * Whether a cel has any visible pixel, cached per buffer. Only cels of the
 * shown frame can change from one edit to the next, so only those are rechecked
 * when the document revision moves on.
 */
const pixelCache = new WeakMap<Uint32Array, { revision: number; filled: boolean }>();
function hasPixels(cel: Uint32Array, revision: number, current: boolean): boolean {
  const hit = pixelCache.get(cel);
  if (hit && (!current || hit.revision === revision)) return hit.filled;
  let filled = false;
  for (let i = 0; i < cel.length; i++) {
    if (cel[i] >>> 24 !== 0) {
      filled = true;
      break;
    }
  }
  pixelCache.set(cel, { revision, filled });
  return filled;
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

/** A press in the grid, and what it turns into as the pointer moves. */
type Gesture =
  | { kind: 'scrub'; anchor: number }
  | { kind: 'select'; anchorRow: number; anchorFrame: number }
  | { kind: 'frames'; lo: number; hi: number; x: number; active: boolean }
  | {
      kind: 'cels';
      selection: TimelineSelection;
      row: number;
      frame: number;
      x: number;
      y: number;
      active: boolean;
    };

/** What the grid draws for a drag in progress. */
type DragView = { kind: 'frames'; slot: number } | { kind: 'cels'; dLayer: number; dFrame: number };

const sorted = (a: number, b: number): [number, number] => (a <= b ? [a, b] : [b, a]);

function LayerHead({ row, active }: { row: Row; active: boolean }) {
  const editor = useEditor();
  const indent = { paddingLeft: 6 + row.depth * INDENT } as CSSProperties;
  if (row.kind === 'group') {
    const g = row.group;
    return (
      <div
        className={cx('tl-layer', 'is-group', !g.visible && 'is-hidden')}
        style={indent}
        role="rowheader"
        aria-selected={active}
        onClick={() => editor.setActiveGroup(g.id)}
      >
        <IconButton
          icon={g.visible ? Eye : EyeOff}
          label={g.visible ? 'Hide group' : 'Show group'}
          onClick={(e) => {
            e.stopPropagation();
            editor.updateGroup(g.id, { visible: !g.visible });
          }}
        />
        <button
          type="button"
          className="layer-fold"
          aria-label={g.collapsed ? 'Expand group' : 'Collapse group'}
          aria-expanded={!g.collapsed}
          onClick={(e) => {
            e.stopPropagation();
            editor.updateGroup(g.id, { collapsed: !g.collapsed });
          }}
        >
          {g.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <FolderOpen size={14} className="tl-folder" aria-hidden="true" />
        <EditableName name={g.name} onRename={(name) => editor.updateGroup(g.id, { name })} />
      </div>
    );
  }
  const l = row.layer;
  return (
    <div
      className={cx('tl-layer', !l.visible && 'is-hidden', l.reference && 'is-reference')}
      style={indent}
      role="rowheader"
      aria-selected={active}
      onClick={(e) => {
        editor.setActiveLayer(l.id);
        const n = editor.getState().frames.length;
        const sel = editor.getState().timelineSelection;
        // Shift extends a row selection; a plain click picks this whole row.
        const ids =
          e.shiftKey && sel?.layerIds.length ? [...new Set([...sel.layerIds, l.id])] : [l.id];
        editor.setTimelineSelection({ layerIds: ids, frames: [0, n - 1] });
      }}
    >
      <IconButton
        icon={l.visible ? Eye : EyeOff}
        label={l.visible ? 'Hide layer' : 'Show layer'}
        onClick={(e) => {
          e.stopPropagation();
          editor.updateLayer(l.id, { visible: !l.visible });
        }}
      />
      <IconButton
        icon={l.locked ? Lock : LockOpen}
        className={cx('layer-lock', l.locked && 'is-locked')}
        label={l.locked ? 'Unlock layer' : 'Lock layer'}
        onClick={(e) => {
          e.stopPropagation();
          editor.updateLayer(l.id, { locked: !l.locked });
        }}
      />
      <EditableName name={l.name} onRename={(name) => editor.updateLayer(l.id, { name })} />
      {l.reference && (
        <span className="layer-badge" title="Reference layer: shown, never exported">
          REF
        </span>
      )}
    </div>
  );
}

/** The timeline: playback controls and the layers × frames grid. */
export function Timeline() {
  const editor = useEditor();
  const s = useEditorState((st) => ({
    frame: st.frame,
    frames: st.frames,
    tags: st.tags,
    playing: st.playing,
    onionSkin: st.onionSkin,
    layers: st.layers,
    groups: st.groups,
    activeLayerId: st.activeLayerId,
    activeGroupId: st.activeGroupId,
    selection: st.timelineSelection,
    revision: st.revision,
  }));
  const [editingTag, setEditingTag] = useState<number | 'new' | null>(null);
  const [celDialog, setCelDialog] = useState(false);
  const [onionOpen, setOnionOpen] = useState(false);
  const [dragView, setDragView] = useState<DragView | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const celsRef = useRef<HTMLDivElement>(null);
  usePlayback();

  const n = s.frames.length;
  const many = n > 1;
  const rows = stackRows(s.layers, s.groups);
  const layerRows = rows.flatMap((r, i) =>
    r.kind === 'layer' ? [{ id: r.layer.id, row: i }] : [],
  );
  const total = s.frames.reduce((a, b) => a + b, 0);

  // Keep the current frame's column in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const x = s.frame * CELL;
    const visible = el.clientWidth - LEFT;
    if (x < el.scrollLeft) el.scrollTo({ left: x });
    else if (x + CELL > el.scrollLeft + visible) el.scrollTo({ left: x + CELL - visible });
  }, [s.frame]);

  // Escape cancels a drag (before the app's own Escape shortcuts see it).
  useEffect(() => {
    if (!dragView) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      gesture.current = null;
      setDragView(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dragView]);

  const frameAt = (clientX: number, el: HTMLElement | null) => {
    const left = el?.getBoundingClientRect().left ?? 0;
    return Math.max(0, Math.min(n - 1, Math.floor((clientX - left) / CELL)));
  };
  const slotAt = (clientX: number, el: HTMLElement | null) => {
    const left = el?.getBoundingClientRect().left ?? 0;
    return Math.max(0, Math.min(n, Math.round((clientX - left) / CELL)));
  };
  const rowAt = (clientY: number) => {
    const top = celsRef.current?.getBoundingClientRect().top ?? 0;
    return Math.max(0, Math.min(rows.length - 1, Math.floor((clientY - top) / ROW)));
  };
  /** How many layer rows sit above row `r` (so group rows don't count as steps). */
  const layerIndexAt = (r: number) => layerRows.filter((lr) => lr.row < r).length;
  const autoScroll = (clientX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (clientX < rect.left + LEFT + SCROLL_EDGE) el.scrollBy({ left: -CELL / 2 });
    else if (clientX > rect.right - SCROLL_EDGE) el.scrollBy({ left: CELL / 2 });
  };
  /** Layer ids of the layer rows between rows a and b (inclusive), top first. */
  const layersBetween = (a: number, b: number) => {
    const [r0, r1] = sorted(a, b);
    return layerRows.filter((lr) => lr.row >= r0 && lr.row <= r1).map((lr) => lr.id);
  };

  // ---- frame header: pick frames, scrub, drag picked frames

  const onHeadDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const f = frameAt(e.clientX, headRef.current);
    const sel = s.selection;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.shiftKey) {
      const anchor =
        sel && !sel.layerIds.length
          ? sel.frames[0] === f
            ? sel.frames[1]
            : sel.frames[0]
          : s.frame;
      editor.setTimelineSelection({ layerIds: [], frames: sorted(anchor, f) });
      editor.setFrame(f);
      gesture.current = { kind: 'scrub', anchor };
      return;
    }
    if (sel && !sel.layerIds.length && f >= sel.frames[0] && f <= sel.frames[1] && many) {
      gesture.current = {
        kind: 'frames',
        lo: sel.frames[0],
        hi: sel.frames[1],
        x: e.clientX,
        active: false,
      };
      return;
    }
    if (s.playing) editor.setPlaying(false);
    editor.setFrame(f);
    editor.setTimelineSelection({ layerIds: [], frames: [f, f] });
    gesture.current = { kind: 'scrub', anchor: f };
  };

  const onHeadMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'scrub') {
      const f = frameAt(e.clientX, headRef.current);
      if (f !== editor.getState().frame) editor.setFrame(f);
      editor.setTimelineSelection({ layerIds: [], frames: sorted(g.anchor, f) });
      autoScroll(e.clientX);
    } else if (g.kind === 'frames') {
      if (!g.active && Math.abs(e.clientX - g.x) < DRAG_THRESHOLD) return;
      g.active = true;
      if (s.playing) editor.setPlaying(false);
      autoScroll(e.clientX);
      setDragView({ kind: 'frames', slot: slotAt(e.clientX, headRef.current) });
    }
  };

  const onHeadUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    setDragView(null);
    if (g?.kind !== 'frames') return;
    if (g.active) {
      editor.moveFrames(g.lo, g.hi, slotAt(e.clientX, headRef.current), e.ctrlKey || e.metaKey);
    } else {
      const f = frameAt(e.clientX, headRef.current);
      editor.setFrame(f);
      editor.setTimelineSelection({ layerIds: [], frames: [f, f] });
    }
  };

  // ---- cels: pick a cel or a block, drag picked cels

  const onCelsDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const r = rowAt(e.clientY);
    const f = frameAt(e.clientX, celsRef.current);
    const row = rows[r];
    if (!row) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (row.kind === 'group') {
      editor.setActiveGroup(row.group.id);
      editor.setFrame(f);
      editor.setTimelineSelection(null);
      gesture.current = null;
      return;
    }
    const sel = s.selection;
    const id = row.layer.id;
    if (e.shiftKey) {
      const anchorRow = rows.findIndex((x) => x.kind === 'layer' && x.layer.id === s.activeLayerId);
      editor.setTimelineSelection({
        layerIds: layersBetween(anchorRow < 0 ? r : anchorRow, r),
        frames: sorted(s.frame, f),
      });
      gesture.current = null;
      return;
    }
    if (sel && sel.layerIds.includes(id) && f >= sel.frames[0] && f <= sel.frames[1]) {
      gesture.current = {
        kind: 'cels',
        selection: sel,
        row: r,
        frame: f,
        x: e.clientX,
        y: e.clientY,
        active: false,
      };
      return;
    }
    editor.setActiveLayer(id);
    editor.setFrame(f);
    editor.setTimelineSelection({ layerIds: [id], frames: [f, f] });
    gesture.current = { kind: 'select', anchorRow: r, anchorFrame: f };
  };

  const onCelsMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const r = rowAt(e.clientY);
    const f = frameAt(e.clientX, celsRef.current);
    if (g.kind === 'select') {
      editor.setTimelineSelection({
        layerIds: layersBetween(g.anchorRow, r),
        frames: sorted(g.anchorFrame, f),
      });
      autoScroll(e.clientX);
    } else if (g.kind === 'cels') {
      const moved = Math.max(Math.abs(e.clientX - g.x), Math.abs(e.clientY - g.y));
      if (!g.active && moved < DRAG_THRESHOLD) return;
      g.active = true;
      autoScroll(e.clientX);
      setDragView({
        kind: 'cels',
        dLayer: layerIndexAt(r) - layerIndexAt(g.row),
        dFrame: f - g.frame,
      });
    }
  };

  const onCelsUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    const view = dragView;
    setDragView(null);
    if (g?.kind !== 'cels') return;
    const r = rowAt(e.clientY);
    const f = frameAt(e.clientX, celsRef.current);
    if (!g.active) {
      const row = rows[r];
      if (row?.kind !== 'layer') return;
      editor.setActiveLayer(row.layer.id);
      editor.setFrame(f);
      editor.setTimelineSelection({ layerIds: [row.layer.id], frames: [f, f] });
      return;
    }
    if (view?.kind !== 'cels') return;
    const order = layerRows.map((lr) => lr.id);
    const targets = g.selection.layerIds.map((id) => order[order.indexOf(id) + view.dLayer]);
    const [lo, hi] = g.selection.frames;
    if (targets.some((t) => !t) || lo + view.dFrame < 0 || hi + view.dFrame >= n) {
      editor.notify("Cels can't move past the edge of the timeline");
      return;
    }
    editor.moveCels(g.selection.layerIds, targets, lo, hi, view.dFrame, e.ctrlKey || e.metaKey);
  };

  // ---- drawing

  const sel = s.selection;
  const selRows = sel
    ? sel.layerIds.length
      ? sel.layerIds
          .map((id) => rows.findIndex((r) => r.kind === 'layer' && r.layer.id === id))
          .filter((i) => i >= 0)
      : null
    : null;
  const selBox =
    sel && (selRows === null || selRows.length)
      ? {
          left: sel.frames[0] * CELL,
          width: (sel.frames[1] - sel.frames[0] + 1) * CELL,
          top: selRows ? Math.min(...selRows) * ROW : 0,
          height: selRows
            ? (Math.max(...selRows) - Math.min(...selRows) + 1) * ROW
            : rows.length * ROW,
        }
      : null;
  const ghost =
    dragView?.kind === 'cels' && selBox && selRows
      ? (() => {
          const order = layerRows.map((lr) => lr.row);
          const top = layerIndexAt(Math.min(...selRows)) + dragView.dLayer;
          const bottom = layerIndexAt(Math.max(...selRows)) + dragView.dLayer;
          const rTop = order[Math.max(0, Math.min(order.length - 1, top))];
          const rBottom = order[Math.max(0, Math.min(order.length - 1, bottom))];
          return {
            left: selBox.left + dragView.dFrame * CELL,
            width: selBox.width,
            top: rTop * ROW,
            height: (rBottom - rTop + 1) * ROW,
          };
        })()
      : null;
  const sprite = editor.sprite;
  const height = rows.length * ROW;

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
          icon={s.playing ? Pause : Play}
          label={s.playing ? 'Pause' : 'Play'}
          shortcut="Enter"
          pressed={s.playing}
          disabled={!many}
          onClick={() => editor.setPlaying(!s.playing)}
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
          onClick={() => editor.setFrame(n - 1)}
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
        <span className="onion-toggle" data-onion-toggle>
          <IconButton
            icon={Layers2}
            label="Onion skin"
            shortcut="Shift+O"
            pressed={s.onionSkin}
            onClick={() => editor.setOnionSkin(!s.onionSkin)}
          />
          <IconButton
            icon={onionOpen ? ChevronDown : ChevronUp}
            className="onion-more"
            label="Onion skin options"
            pressed={onionOpen}
            onClick={() => setOnionOpen((o) => !o)}
          />
          {onionOpen && <OnionOptions onClose={() => setOnionOpen(false)} />}
        </span>

        <span className="divider" />
        <DurationField />

        <span className="timeline-info mono">
          Frame {s.frame + 1} / {n} · {(total / 1000).toFixed(2)} s
        </span>
      </div>

      <div
        className="tl-scroll"
        ref={scrollRef}
        style={
          { '--cell': `${CELL}px`, '--row': `${ROW}px`, '--left': `${LEFT}px` } as CSSProperties
        }
      >
        <div className="tl-corner">Layers</div>
        <div
          className="tl-head"
          ref={headRef}
          style={{ width: n * CELL }}
          onPointerDown={onHeadDown}
          onPointerMove={onHeadMove}
          onPointerUp={onHeadUp}
          onPointerCancel={() => {
            gesture.current = null;
            setDragView(null);
          }}
          title="Click to pick a frame, drag to scrub, drag picked frames to move them (Ctrl copies)"
        >
          <div className="tl-tags">
            {s.tags.map((t, i) => (
              <button
                key={i}
                className="tag"
                title={`${t.name} · frames ${t.from + 1}–${t.to + 1} (click to edit)`}
                onPointerDown={(e) => e.stopPropagation()}
                style={
                  {
                    '--tag': `var(--tag-${(i % TAG_COLOR_COUNT) + 1})`,
                    left: t.from * CELL + 2,
                    width: (t.to - t.from + 1) * CELL - 4,
                  } as CSSProperties
                }
                onClick={() => setEditingTag(i)}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="tl-numbers" role="row" aria-label="Frames">
            {s.frames.map((ms, f) => (
              <span
                key={f}
                className={cx(
                  'tl-number mono',
                  f === s.frame && 'is-current',
                  sel &&
                    !sel.layerIds.length &&
                    f >= sel.frames[0] &&
                    f <= sel.frames[1] &&
                    'is-picked',
                )}
                role="columnheader"
                aria-selected={f === s.frame}
                title={`Frame ${f + 1} · ${ms} ms`}
              >
                {f + 1}
              </span>
            ))}
          </div>
          {dragView?.kind === 'frames' &&
            dragView.slot !== sel?.frames[0] &&
            dragView.slot !== (sel?.frames[1] ?? -2) + 1 && (
              <span
                className="tl-drop"
                style={{ left: dragView.slot * CELL - 1 }}
                aria-hidden="true"
              />
            )}
        </div>

        <div className="tl-layers" role="rowgroup" aria-label="Layers">
          {rows.map((row) => (
            <LayerHead
              key={row.kind === 'group' ? row.group.id : row.layer.id}
              row={row}
              active={
                row.kind === 'group'
                  ? row.group.id === s.activeGroupId
                  : !s.activeGroupId && row.layer.id === s.activeLayerId
              }
            />
          ))}
        </div>

        <div
          className="tl-cels"
          ref={celsRef}
          role="grid"
          aria-label="Cels"
          style={{ width: n * CELL, height }}
          onPointerDown={onCelsDown}
          onPointerMove={onCelsMove}
          onPointerUp={onCelsUp}
          onPointerCancel={() => {
            gesture.current = null;
            setDragView(null);
          }}
          onDoubleClick={(e) => {
            if (rows[rowAt(e.clientY)]?.kind === 'layer') setCelDialog(true);
          }}
        >
          <span
            className="tl-current"
            style={{ left: s.frame * CELL, height }}
            aria-hidden="true"
          />
          {rows.map((row, r) => {
            if (row.kind === 'group') {
              return (
                <span
                  key={row.group.id}
                  className="tl-group-line"
                  style={{ top: r * ROW, width: n * CELL }}
                />
              );
            }
            const layer = sprite.layers.find((l) => l.id === row.layer.id);
            if (!layer) return null;
            const isActive = !s.activeGroupId && row.layer.id === s.activeLayerId;
            return (
              <div key={row.layer.id} className="tl-row" style={{ top: r * ROW }} role="row">
                {layer.cels.map((cel, f) => {
                  const filled = hasPixels(cel, s.revision, f === s.frame);
                  const linkedToPrev = f > 0 && layer.cels[f - 1] === cel;
                  return (
                    <span
                      key={f}
                      className={cx(
                        'tl-cel',
                        filled ? 'is-filled' : 'is-empty',
                        linkedToPrev && 'is-linked',
                        celOpacity(cel) < 1 && 'is-faded',
                        isActive && f === s.frame && 'is-active',
                      )}
                      role="gridcell"
                      aria-selected={isActive && f === s.frame}
                      title={`${row.layer.name} · frame ${f + 1}${filled ? '' : ' (empty)'}${linkedToPrev ? ' · linked' : ''}`}
                    />
                  );
                })}
              </div>
            );
          })}
          {selBox && <span className="tl-selection" style={selBox} aria-hidden="true" />}
          {ghost && <span className="tl-ghost" style={ghost} aria-hidden="true" />}
          {dragView?.kind === 'frames' &&
            dragView.slot !== sel?.frames[0] &&
            dragView.slot !== (sel?.frames[1] ?? -2) + 1 && (
              <span
                className="tl-drop"
                style={{ left: dragView.slot * CELL - 1, height }}
                aria-hidden="true"
              />
            )}
        </div>
      </div>

      {editingTag !== null && (
        <TagDialog
          index={editingTag === 'new' ? null : editingTag}
          onClose={() => setEditingTag(null)}
        />
      )}
      {celDialog && <CelPropertiesDialog onClose={() => setCelDialog(false)} />}
    </section>
  );
}
