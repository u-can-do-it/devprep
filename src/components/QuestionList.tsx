import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { isDev } from '../lib/api.ts';
import { LEVEL_LABEL } from '../lib/format.ts';
import { filtered, filters, hasActiveFilters, questions, resetFilters, setEditing, setFilters, target, type SortKey } from '../lib/state.ts';
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

  const importanceLabel = () => (target() === 'any' ? 'Importance' : `Importance (${LEVEL_LABEL[target() as 'mid']})`);

  return (
    <>
      <div class="toolbar">
        <span class="results">
          {filtered().length} {filtered().length === 1 ? 'question' : 'questions'}
        </span>
        <span class="spacer" />
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
      <div ref={sentinel} style={{ height: '1px' }} />
    </>
  );
}
