import type { ReactNode } from 'react';

/** A keyboard shortcut, boxed (Figma: Kbd). */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
