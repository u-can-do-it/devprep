import { createSignal } from 'solid-js';
import type { Progress, ProgressStatus } from './format.ts';

const KEY = 'devprep:progress';

function load(): Progress {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

const [progress, setProgressSignal] = createSignal<Progress>(load());
export { progress };

function commit(next: Progress) {
  setProgressSignal(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode etc.): progress lives for this session only.
  }
}

export const statusOf = (id: number): ProgressStatus | null => progress()[id]?.status ?? null;

export function setStatus(id: number, status: ProgressStatus | null) {
  commit({ ...progress(), [id]: { status, updated: new Date().toISOString() } });
}

/** Toggle: clicking the active status again clears it. */
export const toggleStatus = (id: number, status: ProgressStatus) =>
  setStatus(id, statusOf(id) === status ? null : status);

/** Merge another progress set; the newer entry wins per question. */
export function mergeProgress(incoming: Progress) {
  const current = progress();
  let changed = false;
  const next = { ...current };
  for (const [id, entry] of Object.entries(incoming)) {
    const mine = current[Number(id)];
    if (!mine || entry.updated > mine.updated) {
      next[Number(id)] = entry;
      changed = true;
    }
  }
  if (changed) commit(next);
}
