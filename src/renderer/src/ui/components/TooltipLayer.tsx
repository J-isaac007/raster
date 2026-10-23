import { useEffect, useState, type CSSProperties } from 'react';
import { Kbd } from './Kbd';

const DELAY_MS = 450;

interface Tip {
  label: string;
  shortcut?: string;
  style: CSSProperties;
  place: 'right' | 'below';
}

function place(el: HTMLElement): Tip {
  const r = el.getBoundingClientRect();
  const label = el.dataset.tooltip ?? '';
  const shortcut = el.dataset.shortcut;
  // Toolbar buttons get their tip to the right; everything else below,
  // pinned to the right edge near the window's right side.
  if (el.closest('.toolbar')) {
    return {
      label,
      shortcut,
      place: 'right',
      style: { left: r.right + 8, top: r.top + r.height / 2 },
    };
  }
  const nearRight = r.left + r.width / 2 > window.innerWidth - 160;
  const style: CSSProperties = nearRight
    ? { right: window.innerWidth - r.right, top: r.bottom + 6 }
    : { left: r.left + r.width / 2, top: r.bottom + 6, transform: 'translateX(-50%)' };
  return { label, shortcut, place: 'below', style };
}

/**
 * Shows a tooltip, with its shortcut, for any element with `data-tooltip`
 * (every IconButton) after a short hover. One layer for the whole app.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLElement | null = null;
    const hide = () => {
      clearTimeout(timer);
      current = null;
      setTip(null);
    };
    const onOver = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-tooltip]') ?? null;
      if (el === current) return;
      hide();
      current = el;
      if (el) timer = setTimeout(() => el.isConnected && setTip(place(el)), DELAY_MS);
    };
    window.addEventListener('pointerover', onOver);
    window.addEventListener('pointerdown', hide);
    window.addEventListener('keydown', hide);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', hide);
      window.removeEventListener('keydown', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!tip) return null;
  return (
    <div className={`tooltip tooltip-${tip.place}`} role="tooltip" style={tip.style}>
      {tip.label}
      {tip.shortcut && <Kbd>{tip.shortcut}</Kbd>}
    </div>
  );
}
