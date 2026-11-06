// Find in list: an in-app Ctrl+F. The list renders in pages, so the browser's own find can't see
// cards that aren't rendered yet. This searches the whole current (filtered, sorted) list with the
// same typo-tolerant matching as the sidebar search, highlights matches without filtering, and
// steps through matching questions, rendering cards as needed.
import { batch, createEffect, createMemo, createRoot, createSignal, on, untrack } from 'solid-js';
import { debounced } from './debounce.ts';
import { matchAll, parseQuery, type SearchEntry, type SearchMatch } from './search.ts';
import { filtered, searchEntries } from './state.ts';
import { topCardIndex } from './viewport.ts';

export const [findQuery, setFindQuery] = createSignal('');
const [query, flushFindQuery] = debounced(findQuery, 120);

/** id → what to highlight, for questions in the current list that match, in list order. */
export const findMatches = createRoot(() =>
  createMemo(() => {
    const all = searchEntries();
    const list = filtered()
      .map((q) => [q.id, all.get(q.id)] as const)
      .filter((e): e is readonly [number, SearchEntry] => !!e[1]);
    const out = new Map<number, SearchMatch>();
    for (const [id, m] of matchAll(list, query())) if (m) out.set(id, m);
    return out;
  }),
);

/** Matching question ids in list order. */
export const findIds = createRoot(() => createMemo(() => [...findMatches().keys()]));
export const findCount = () => findIds().length;
/** Whether the box holds a searchable query (single characters are ignored), matches or not. */
export const findActive = () => parseQuery(query()).length > 0;

// The current match is kept by id, so it survives the list changing around it (e.g. marking a
// question known); `findIndex` is -1 when that question has left the list.
const [current, setCurrent] = createSignal<number | null>(null);
export const findIndex = () => {
  const c = current();
  return c === null ? -1 : findIds().indexOf(c);
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

function goTo(id: number | null) {
  batch(() => {
    setCurrent(id);
    if (id !== null) setScrollTick((n) => n + 1);
  });
}

/** The first match at or below the card at the top of the screen, like a browser's find. */
function nearestMatch(list: number[]) {
  const top = Math.max(0, topCardIndex());
  const position = new Map(filtered().map((q, i) => [q.id, i]));
  return list.find((id) => (position.get(id) ?? 0) >= top) ?? list[0] ?? null;
}

// A new query starts again from where you are in the list.
createRoot(() => createEffect(on(query, () => untrack(() => goTo(nearestMatch(findIds()))), { defer: true })));

/** Step to the next (1) or previous (-1) matching question, wrapping around. */
export function moveFind(step: 1 | -1) {
  // Enter right after typing: run the pending query, which already goes to the nearest match.
  if (flushFindQuery()) return;
  const list = findIds();
  if (!list.length) return;
  const i = findIndex();
  goTo(i < 0 ? nearestMatch(list) : list[(i + step + list.length) % list.length]);
}
