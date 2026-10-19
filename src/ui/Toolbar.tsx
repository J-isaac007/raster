import {
  Circle,
  Contrast,
  Eraser,
  PaintBucket,
  Pencil,
  Pipette,
  Slash,
  Square,
  SquareDashed,
  type LucideIcon,
} from 'lucide-react';
import { useEditor, useEditorState } from '../editor/context';
import type { ToolId } from '../editor/editor';
import { TOOLS } from '../editor/tools';

const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  select: SquareDashed,
  pencil: Pencil,
  eraser: Eraser,
  shade: Contrast,
  fill: PaintBucket,
  line: Slash,
  rect: Square,
  ellipse: Circle,
  picker: Pipette,
};

export function Toolbar() {
  const editor = useEditor();
  const current = useEditorState((s) => s.tool);
  return (
    <nav className="toolbar" aria-label="Tools">
      {TOOLS.map((tool) => {
        const Icon = TOOL_ICONS[tool.id];
        return (
          <button
            key={tool.id}
            className="tool"
            aria-pressed={current === tool.id}
            title={`${tool.label} (${tool.shortcut})`}
            aria-label={tool.label}
            onClick={() => editor.setTool(tool.id)}
          >
            <Icon size={17} strokeWidth={1.75} />
          </button>
        );
      })}
    </nav>
  );
}
