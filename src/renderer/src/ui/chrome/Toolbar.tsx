import {
  Circle,
  Contrast,
  Eraser,
  LassoSelect,
  PaintBucket,
  Pencil,
  Pipette,
  Slash,
  Square,
  SquareDashed,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import { Fragment } from 'react';
import type { ToolId } from '@editor/editor';
import { TOOL_BY_ID } from '@editor/tools';
import { IconButton } from '../components';
import { useEditor, useEditorState } from '../editorContext';

const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  select: SquareDashed,
  lasso: LassoSelect,
  wand: WandSparkles,
  pencil: Pencil,
  eraser: Eraser,
  shade: Contrast,
  fill: PaintBucket,
  line: Slash,
  rect: Square,
  ellipse: Circle,
  picker: Pipette,
};

/** Selection, painting, shapes, then the picker, with a rule between groups. */
const GROUPS: ToolId[][] = [
  ['select', 'lasso', 'wand'],
  ['pencil', 'eraser', 'shade', 'fill'],
  ['line', 'rect', 'ellipse'],
  ['picker'],
];

export function Toolbar() {
  const editor = useEditor();
  const current = useEditorState((s) => s.tool);
  return (
    <nav className="toolbar" aria-label="Tools">
      {GROUPS.map((group, i) => (
        <Fragment key={group[0]}>
          {i > 0 && <span className="divider horizontal" />}
          {group.map((id) => {
            const tool = TOOL_BY_ID[id];
            return (
              <IconButton
                key={id}
                size="tool"
                icon={TOOL_ICONS[id]}
                label={tool.label}
                shortcut={tool.shortcut}
                pressed={current === id}
                onClick={() => editor.setTool(id)}
              />
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
}
