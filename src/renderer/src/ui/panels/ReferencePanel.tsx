import { Eye, EyeOff, X } from 'lucide-react';
import { Chip, Chips, IconButton, PanelSection, Slider } from '../components';
import { useEditor, useEditorState } from '../editorContext';

/** Controls for the reference image overlay. Shown only while one is loaded. */
export function ReferencePanel() {
  const editor = useEditor();
  const reference = useEditorState((s) => s.reference);
  if (!reference) return null;

  return (
    <PanelSection
      title="Reference"
      actions={
        <>
          <IconButton
            icon={reference.visible ? Eye : EyeOff}
            label={reference.visible ? 'Hide reference' : 'Show reference'}
            shortcut="Shift+R"
            onClick={() => editor.updateReference({ visible: !reference.visible })}
          />
          <IconButton
            icon={X}
            label="Remove reference image"
            onClick={() => editor.setReference(null)}
          />
        </>
      }
    >
      <Slider
        label="Opacity"
        min={5}
        max={100}
        value={Math.round(reference.opacity * 100)}
        display={`${Math.round(reference.opacity * 100)}%`}
        onChange={(v) => editor.updateReference({ opacity: v / 100 })}
      />
      <Chips>
        <Chip pressed={!reference.above} onClick={() => editor.updateReference({ above: false })}>
          Behind art
        </Chip>
        <Chip pressed={reference.above} onClick={() => editor.updateReference({ above: true })}>
          Over art
        </Chip>
      </Chips>
    </PanelSection>
  );
}
