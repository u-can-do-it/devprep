// Find in list: an in-app Ctrl+F. The list renders in pages, so the browser's own find can't see
// cards that aren't rendered yet. This searches the whole current (filtered, sorted) list with the
// same typo-tolerant matching as the sidebar search, highlights matches without filtering, and
// steps through matching questions, rendering cards as needed.
import { batch, createEffect, createMemo, createRoot, createSignal, on, untrack } from 'solid-js';
import { matchEntry, parseQuery, typoTerms, type SearchEntry, type SearchMatch } from './search.ts';
import { filtered, searchEntries } from './state.ts';
import { topCardIndex } from './viewport.ts';

export const [findOpen, setFindOpen] = createSignal(false);
export const [findQuery, setFindQueryRaw] = createSignal('');

// Matching runs on a debounced copy of the input so typing stays smooth.
const [query, setQuery] = createSignal('');
let timer: ReturnType<typeof setTimeout> | undefined;
export function setFindQuery(value: string) {
  setFindQueryRaw(value);
  clearTimeout(timer);
  timer = setTimeout(() => setQuery(value), 120);
}
/** Apply the typed query now (Enter right after typing shouldn't wait for the debounce). */
export function flushFindQuery() {
  clearTimeout(timer);
  setQuery(findQuery());
}

/** Whether the find box has anything to search for (single characters are ignored). */
export const findActive = () => findOpen() && parseQuery(query()).length > 0;

/** id → what to highlight, for questions in the current list that match. Empty when closed. */
export const findMatches = createRoot(() =>
  createMemo(() => {
    const out = new Map<number, SearchMatch>();
    const terms = parseQuery(query());
    if (!findOpen() || !terms.length) return out;
    const all = searchEntries();
    const list = filtered()
      .map((q) => [q.id, all.get(q.id)] as const)
      .filter((e): e is readonly [number, SearchEntry] => !!e[1]);
    // Typos are judged against this list only: a word that appears nowhere in it gets fuzzy matching.
    const typos = typoTerms(terms, list.map(([, e]) => e));
    for (const [id, entry] of list) {
      const m = matchEntry(entry, terms, typos);
      if (m) out.set(id, m);
    }
    return out;
  }),
);

/** Matching question ids in list order. */
const ids = createRoot(() => createMemo(() => [...findMatches().keys()]));
export const findCount = () => ids().length;

// The current match is kept by id, so it survives the list changing around it (e.g. marking a
// question known); it's -1 in `findIndex` when the question has left the list.
const [current, setCurrent] = createSignal<number | null>(null);
export const findIndex = () => {
  const c = current();
  return c === null ? -1 : ids().indexOf(c);
};
export const findCurrentId = () => (findIndex() >= 0 ? current() : null);

/** Bumped whenever the current match should be scrolled into view; the card claims each bump once. */
const [scrollTick, setScrollTick] = createSignal(0);
export const findScroll = scrollTick;
let claimed = 0;
export function claimFindScroll() {
  const t = untrack(scrollTick);
  if (t === claimed) return false;
  claimed = t;
  return true;
}

/** The first match at or below the card at the top of the screen, like a browser's find. */
function nearestMatch(list: number[]) {
  const top = Math.max(0, topCardIndex());
  const position = new Map(filtered().map((q, i) => [q.id, i]));
  return list.find((id) => (position.get(id) ?? 0) >= top) ?? list[0];
}

function restart() {
  const list = ids();
  batch(() => {
    setCurrent(list.length ? nearestMatch(list) : null);
    if (list.length) setScrollTick((n) => n + 1);
  });
}

// A new query, or reopening the bar, starts again from where you are in the list.
createRoot(() => createEffect(on([query, findOpen], () => untrack(restart), { defer: true })));

/** Step to the next (1) or previous (-1) matching question, wrapping around. */
export function moveFind(step: 1 | -1) {
  const list = ids();
  if (!list.length) return;
  const i = findIndex();
  batch(() => {
    setCurrent(i < 0 ? nearestMatch(list) : list[(i + step + list.length) % list.length]);
    setScrollTick((n) => n + 1);
  });
}

/** Ask the open bar to focus its input (and select the text). */
const [focusTick, setFocusTick] = createSignal(0);
export const findFocus = focusTick;

export function openFind(prefill?: string) {
  batch(() => {
    if (prefill) {
      setFindQueryRaw(prefill);
      flushFindQuery();
    }
    setFindOpen(true);
    setFocusTick((n) => n + 1);
  });
}
