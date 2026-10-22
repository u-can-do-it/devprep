import { createSignal } from 'solid-js';
import type { Question } from './format.ts';

const KEY = 'devprep:bookmarks';

/** Category (tag id) → bookmarked question id. One bookmark per category: a new one replaces the old. */
export type Bookmarks = Record<string, number>;

function load(): Bookmarks {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

const [bookmarks, setBookmarksSignal] = createSignal<Bookmarks>(load());
export { bookmarks };

function commit(next: Bookmarks) {
  setBookmarksSignal(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode etc.): bookmarks live for this session only.
  }
}

/** A question's category is its first tag. */
export const categoryOf = (q: Question) => q.tags[0];

export const isBookmarked = (q: Question) => bookmarks()[categoryOf(q)] === q.id;

export function removeBookmark(category: string) {
  const { [category]: _, ...rest } = bookmarks();
  commit(rest);
}

/** Toggle: bookmarking a question moves its category's bookmark here; clicking again clears it. */
export function toggleBookmark(q: Question) {
  const category = categoryOf(q);
  if (!category) return;
  if (isBookmarked(q)) removeBookmark(category);
  else commit({ ...bookmarks(), [category]: q.id });
}
