import { useSyncExternalStore } from 'react';
import { getSavedPalettes, subscribeSavedPalettes } from '@platform/palettes';
import { getRecentFiles, subscribeRecent } from '@platform/recent';
import { getSettings, subscribeSettings } from '@platform/settings';

/** The current preferences; re-renders when they change. */
export const useSettings = () => useSyncExternalStore(subscribeSettings, getSettings);

/** The recent-files list; call `refreshRecent()` when showing it. */
export const useRecentFiles = () => useSyncExternalStore(subscribeRecent, getRecentFiles);

/** My palettes, newest first; re-renders when the library changes. */
export const useSavedPalettes = () =>
  useSyncExternalStore(subscribeSavedPalettes, getSavedPalettes);
