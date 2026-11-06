import { onCleanup, onMount, Show } from 'solid-js';
import { findActive, findCount, findIndex, findQuery, moveFind, setFindQuery } from '../lib/find.ts';
import { editing } from '../lib/state.ts';

const mod = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && !e.altKey;

/** Find-in-list box in the header (see lib/find.ts). Shown with the list view only. */
export function FindBox() {
  let input!: HTMLInputElement;

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing() !== null) return;
      const key = e.key.toLowerCase();
      if (mod(e) && key === 'f') {
        // A second Ctrl+F while the box is focused falls through to the browser's own find.
        if (document.activeElement === input) return;
        e.preventDefault();
        // Like a browser: a short, one-line selection becomes the query.
        const sel = window.getSelection()?.toString().trim() ?? '';
        if (sel && sel.length <= 60 && !sel.includes('\n')) setFindQuery(sel);
        input.focus();
        input.select();
      } else if ((e.key === 'F3' || (mod(e) && key === 'g')) && findQuery()) {
        e.preventDefault();
        moveFind(e.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  const label = () => {
    if (!findCount()) return 'No matches';
    const i = findIndex();
    return `${i >= 0 ? i + 1 : '–'} / ${findCount()}`;
  };

  return (
    <div class="find-box" role="search" title="Find in this list without filtering it (Ctrl+F)">
      <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={input}
        type="text"
        placeholder="Find in list"
        aria-label="Find in this list"
        autocomplete="off"
        spellcheck={false}
        enterkeyhint="search"
        value={findQuery()}
        onInput={(e) => setFindQuery(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            moveFind(e.shiftKey ? -1 : 1);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            if (findQuery()) setFindQuery('');
            else input.blur();
          }
        }}
      />
      <Show when={findActive()}>
        <span class="find-count" classList={{ none: !findCount() }} aria-live="polite">
          {label()}
        </span>
        <button class="ghost icon" title="Previous question (Shift+Enter)" aria-label="Previous match" disabled={!findCount()} onClick={() => moveFind(-1)}>
          ↑
        </button>
        <button class="ghost icon" title="Next question (Enter)" aria-label="Next match" disabled={!findCount()} onClick={() => moveFind(1)}>
          ↓
        </button>
      </Show>
    </div>
  );
}
