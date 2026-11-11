import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { cx } from '../components';

/**
 * Where a docked dialog sits: the top right of the canvas area, clear of the
 * sidebar, so the art stays in view.
 */
function useDockedPosition(docked: boolean): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();
  useLayoutEffect(() => {
    if (!docked) return;
    const place = () => {
      const stage = document.querySelector('.stage')?.getBoundingClientRect();
      const gap = 16;
      setStyle(
        stage
          ? { top: stage.top + gap, right: window.innerWidth - stage.right + gap }
          : { top: gap, right: gap },
      );
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [docked]);
  return style;
}

/**
 * The modal shell every dialog uses: backdrop, title, Escape to close (Figma:
 * Dialog). A `docked` dialog sits beside the canvas without dimming it, for
 * live previews (Figma: Main window — Hue/Saturation preview); a click
 * anywhere else still closes it.
 */
export function Dialog({
  title,
  onClose,
  children,
  wide,
  docked = false,
  className,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  docked?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dockedStyle = useDockedPosition(docked);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Fields marked `data-own-escape` (inline renames) use Escape to cancel themselves.
      const own = e.target instanceof HTMLElement && e.target.closest('[data-own-escape]');
      if (e.key === 'Escape' && !own) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    ref.current?.querySelector<HTMLElement>('input, select, .btn-primary')?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className={cx('backdrop', docked && 'is-docked')}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cx('dialog', wide && 'wide', docked && 'docked', className)}
        style={dockedStyle}
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
