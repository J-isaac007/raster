import { useSyncExternalStore } from 'react';
import { getRecentFiles, subscribeRecent } from '@platform/recent';
import { getSettings, subscribeSettings } from '@platform/settings';

/** The current preferences; re-renders when they change. */
export const useSettings = () => useSyncExternalStore(subscribeSettings, getSettings);

/** The recent-files list; call `refreshRecent()` when showing it. */
export const useRecentFiles = () => useSyncExternalStore(subscribeRecent, getRecentFiles);
