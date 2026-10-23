import type { Accent } from '@shared/settings';

interface AccentColors {
  base: string;
  hover: string;
  pressed: string;
  /** Text and icons drawn on the accent (dark on light accents). */
  on: string;
}

/** The accent choices in Preferences. Blue matches the defaults in styles/tokens.css. */
export const ACCENT_COLORS: Record<Accent, AccentColors> = {
  blue: { base: '#5b8cff', hover: '#7aa2ff', pressed: '#4a78e8', on: '#ffffff' },
  green: { base: '#4ade80', hover: '#6ee79b', pressed: '#34c46c', on: '#0d1f14' },
  yellow: { base: '#ffd166', hover: '#ffdc8a', pressed: '#e8b94a', on: '#2a2008' },
  pink: { base: '#ff6b8b', hover: '#ff8ca3', pressed: '#e85474', on: '#ffffff' },
  purple: { base: '#b388ff', hover: '#c5a3ff', pressed: '#9a6ef0', on: '#ffffff' },
  orange: { base: '#ff9f43', hover: '#ffb56e', pressed: '#e8872a', on: '#2a1600' },
};

/** Overrides the accent tokens on the document root. */
export function applyAccent(accent: Accent): void {
  const c = ACCENT_COLORS[accent];
  const root = document.documentElement.style;
  root.setProperty('--accent', c.base);
  root.setProperty('--accent-hover', c.hover);
  root.setProperty('--accent-pressed', c.pressed);
  root.setProperty('--on-accent', c.on);
}
