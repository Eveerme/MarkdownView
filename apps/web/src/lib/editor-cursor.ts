import { useSyncExternalStore } from "react";

export interface EditorCursor {
  column: number;
  line: number;
  selectedWords: number;
}

const initialCursor: EditorCursor = { column: 1, line: 1, selectedWords: 0 };

/**
 * The caret is read by the status bar alone. Keeping it outside React state
 * means an arrow key updates one small footer instead of re-rendering the
 * workspace around it.
 */
let cursor = initialCursor;

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => cursor;

export const publishCursor = (next: EditorCursor) => {
  if (
    next.column === cursor.column &&
    next.line === cursor.line &&
    next.selectedWords === cursor.selectedWords
  ) {
    return;
  }

  cursor = next;

  for (const listener of listeners) {
    listener();
  }
};

export const useEditorCursor = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
