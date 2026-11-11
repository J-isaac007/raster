import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Documents } from '@app/documents';

export const DocumentsContext = createContext<Documents | null>(null);

/** The open documents (tabs). */
export function useDocuments(): Documents {
  const docs = useContext(DocumentsContext);
  if (!docs) throw new Error('useDocuments must be used inside <DocumentsContext.Provider>.');
  return docs;
}

/** The tabs in order and the active one; re-renders when they change. */
export function useTabs() {
  const docs = useDocuments();
  return useSyncExternalStore(docs.subscribe, docs.getSnapshot);
}
