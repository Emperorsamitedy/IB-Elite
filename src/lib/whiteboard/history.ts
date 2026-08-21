import type { CanvasData } from "./types";

/** Undo is snapshot-based: every action records the whole board. */
export const HISTORY_LIMIT = 20;

export type History = {
  /** Oldest first; `index` points at the state currently on screen. */
  entries: CanvasData[];
  index: number;
};

export function createHistory(initial: CanvasData): History {
  return { entries: [initial], index: 0 };
}

/**
 * Records a new state. Anything that was undone is discarded — redoing past a
 * fresh edit would resurrect a branch the student has already abandoned.
 */
export function push(history: History, snapshot: CanvasData): History {
  const entries = [...history.entries.slice(0, history.index + 1), snapshot];
  const trimmed = entries.slice(-HISTORY_LIMIT);
  return { entries: trimmed, index: trimmed.length - 1 };
}

export function canUndo(history: History): boolean {
  return history.index > 0;
}

export function canRedo(history: History): boolean {
  return history.index < history.entries.length - 1;
}

export function undo(history: History): History {
  return canUndo(history) ? { ...history, index: history.index - 1 } : history;
}

export function redo(history: History): History {
  return canRedo(history) ? { ...history, index: history.index + 1 } : history;
}

export function current(history: History): CanvasData {
  return history.entries[history.index];
}
