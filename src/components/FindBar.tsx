import { createEffect, createSignal, on, onCleanup, onMount, Show } from 'solid-js';
import {
  findActive,
  findCount,
  findFocus,
  findIndex,
  findOpen,
  findQuery,
  flushFindQuery,
  moveFind,
  openFind,
  setFindOpen,
  setFindQuery,
} from '../lib/find.ts';
import { editing } from '../lib/state.ts';

const isFindKey = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f';
const isNextKey = (e: KeyboardEvent) => e.key === 'F3' || ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'g');

/** Find-in-list bar pinned under the header (see lib/find.ts). Mounted with the list view only. */
export function FindBar() {
  let input: HTMLInputElement | undefined;
  // Sits just under the sticky header, whose height changes when it wraps on narrow screens.
  const [top, setTop] = createSignal(0);

  onMount(() => {
    const header = document.querySelector<HTMLElement>('.header');
    const ro = new ResizeObserver(() => setTop(header?.getBoundingClientRect().height ?? 0));
    if (header) ro.observe(header);

    const onKey = (e: KeyboardEvent) => {
      if (editing() !== null) return;
      if (isFindKey(e)) {
        // A second Ctrl+F while the bar is focused falls through to the browser's own find.
        if (document.activeElement === input) return;
        e.preventDefault();
        // Like a browser: a short, one-line selection becomes the query.
        const sel = window.getSelection()?.toString().trim() ?? '';
        openFind(sel && sel.length <= 60 && !sel.includes('\n') ? sel : undefined);
      } else if (isNextKey(e) && findOpen()) {
        e.preventDefault();
        flushFindQuery();
        moveFind(e.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
    });
  });

  createEffect(
    on(
      findFocus,
      () =>
        queueMicrotask(() => {
          input?.focus();
          input?.select();
        }),
      { defer: true },
    ),
  );

  // Leaving the list view (or unmounting) closes the bar so marks don't linger.
  onCleanup(() => setFindOpen(false));

  const label = () => {
    if (!findActive()) return '';
    if (!findCount()) return 'No matches';
    const i = findIndex();
    return `${i >= 0 ? i + 1 : '–'} / ${findCount()}`;
  };

  return (
    <Show when={findOpen()}>
      <div class="find-bar" role="search" style={{ top: `${top()}px` }}>
        <input
          ref={input}
          type="text"
          placeholder="Find in this list"
          aria-label="Find in this list"
          autocomplete="off"
          spellcheck={false}
          enterkeyhint="search"
          value={findQuery()}
          onInput={(e) => setFindQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              flushFindQuery();
              moveFind(e.shiftKey ? -1 : 1);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setFindOpen(false);
            }
          }}
        />
        <span class="find-count" classList={{ none: findActive() && !findCount() }} aria-live="polite">
          {label()}
        </span>
        <button class="ghost icon" title="Previous question (Shift+Enter)" aria-label="Previous match" disabled={!findCount()} onClick={() => moveFind(-1)}>
          ↑
        </button>
        <button class="ghost icon" title="Next question (Enter)" aria-label="Next match" disabled={!findCount()} onClick={() => moveFind(1)}>
          ↓
        </button>
        <button class="ghost icon" title="Close (Esc)" aria-label="Close find" onClick={() => setFindOpen(false)}>
          ✕
        </button>
      </div>
    </Show>
  );
}
