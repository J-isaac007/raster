import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '../components';

/** The modal shell every dialog uses: backdrop, title, Escape to close (Figma: Dialog). */
export function Dialog({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    ref.current?.querySelector<HTMLElement>('input, select, .btn-primary')?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={cx('dialog', wide && 'wide')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Explanatory text under a dialog's form. */
export function DialogNote({ children }: { children: ReactNode }) {
  return <p className="dialog-note">{children}</p>;
}

/** The button row: secondary actions, then the primary action last. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="dialog-actions">{children}</div>;
}
