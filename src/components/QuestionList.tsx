import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { isDev } from '../lib/api.ts';
import { LEVEL_LABEL } from '../lib/format.ts';
import { progress } from '../lib/progress.ts';
import {
  filtered,
  filters,
  hasActiveFilters,
  questions,
  resetFilters,
  searchMatches,
  setEditing,
  setFilters,
  target,
  type SortKey,
} from '../lib/state.ts';
import { QuestionCard } from './QuestionCard.tsx';

const PAGE = 40;

export function QuestionList() {
  const [limit, setLimit] = createSignal(PAGE);
  const visible = () => filtered().slice(0, limit());
  let sentinel!: HTMLDivElement;
  // Back to the first page when the filters change (not when progress marks change).
  const filterKey = () => JSON.stringify(filters) + target();
  createEffect(on(filterKey, () => setLimit(PAGE), { defer: true }));

  // Render cards in pages; load more as the bottom comes into view.
  onMount(() => {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && limit() < filtered().length) setLimit((n) => n + PAGE);
    });
    io.observe(sentinel);
    // Deep link to #q-<id>: make sure the card is rendered, then scroll to it.
    const m = location.hash.match(/^#q-(\d+)$/);
    if (m) {
      const idx = filtered().findIndex((q) => q.id === Number(m[1]));
      if (idx >= limit()) setLimit(idx + PAGE);
      requestAnimationFrame(() => document.getElementById(`q-${m[1]}`)?.scrollIntoView());
    }
    onCleanup(() => io.disconnect());
  });

  /** "8 in questions · 5 only in answers" while searching. */
  const searchSplit = () => {
    const m = searchMatches();
    if (!m.size) return '';
    const inTitle = filtered().filter((q) => (m.get(q.id)?.tier ?? 0) < 2).length;
    const elsewhere = filtered().length - inTitle;
    return elsewhere ? `${inTitle} in questions, ${elsewhere} only in hints or answers` : '';
  };

  // "Unseen" and "to review" already leave known questions out, so they count as hiding them too.
  const hidingKnown = () => ['hide-known', 'unseen', 'review'].includes(filters.progress);
  const knownCount = () => Object.values(progress()).filter((e) => e.status === 'known').length;

  const importanceLabel = () => (target() === 'any' ? 'Importance' : `Importance (${LEVEL_LABEL[target() as 'mid']})`);

  return (
    <>
      <div class="toolbar">
        <span class="results">
          {filtered().length} {filtered().length === 1 ? 'question' : 'questions'}
          <Show when={searchSplit()}>{(split) => <span class="results-split"> · {split()}</span>}</Show>
        </span>
        <span class="spacer" />
        <label class="toggle" title="Also available as Progress → Hide known in the sidebar">
          <input
            type="checkbox"
            checked={hidingKnown()}
            onChange={(e) => setFilters('progress', e.currentTarget.checked ? 'hide-known' : 'all')}
          />
          Hide known ({knownCount()})
        </label>
        <label>
          Sort
          <select value={filters.sort} onChange={(e) => setFilters('sort', e.currentTarget.value as SortKey)}>
            <option value="importance">{importanceLabel()}</option>
            <option value="difficulty-asc">Difficulty: easiest first</option>
            <option value="difficulty-desc">Difficulty: hardest first</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <Show when={isDev}>
          <button class="primary" onClick={() => setEditing('new')}>
            + Add question
          </button>
        </Show>
      </div>

      <Show
        when={filtered().length}
        fallback={
          <div class="empty">
            <p>{questions().length ? 'No questions match these filters.' : 'There are no questions yet.'}</p>
            <Show when={hasActiveFilters()}>
              <button onClick={resetFilters}>Reset filters</button>
            </Show>
          </div>
        }
      >
        <For each={visible()}>{(q) => <QuestionCard q={q} />}</For>
      </Show>
      <div ref={sentinel} class="sentinel" />
    </>
  );
}
