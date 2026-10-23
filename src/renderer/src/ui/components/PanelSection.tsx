import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cx } from './cx';

const storageKey = (title: string) => `raster.panel.${title}`;

function readOpen(title: string): boolean {
  try {
    return localStorage.getItem(storageKey(title)) !== 'closed';
  } catch {
    return true;
  }
}

interface PanelSectionProps {
  title: string;
  /** Small icon buttons shown on the right of the header. */
  actions?: ReactNode;
  /** Takes the remaining height of the sidebar while open. */
  grow?: boolean;
  children: ReactNode;
}

/** A collapsible side-panel section; remembers whether it was open (Figma: PanelSection). */
export function PanelSection({ title, actions, grow, children }: PanelSectionProps) {
  const [open, setOpen] = useState(() => readOpen(title));
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(storageKey(title), open ? 'closed' : 'open');
    } catch {
      // Not remembered; fine.
    }
  };

  return (
    <section className={cx('panel-section', grow && open && 'grow')} aria-label={title}>
      <header className="panel-header">
        <button type="button" className="panel-toggle" aria-expanded={open} onClick={toggle}>
          <ChevronDown size={14} className="panel-chevron" aria-hidden="true" />
          <span className="panel-title">{title}</span>
        </button>
        {actions && open && <div className="panel-actions">{actions}</div>}
      </header>
      {open && <div className="panel-body">{children}</div>}
    </section>
  );
}
