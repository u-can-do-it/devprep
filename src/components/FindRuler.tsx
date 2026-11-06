import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { findActive, findCurrentId, findIds } from '../lib/find.ts';

type Tick = { id: number; top: number };

/**
 * Find-in-list matches marked along the right edge, beside the scrollbar (like a browser's find):
 * one tick per matching question at its place in the page, the current one highlighted.
 * The list renders every card while finding, so the page (and scrollbar) spans the whole list.
 */
export function FindRuler() {
  const [ticks, setTicks] = createSignal<Tick[]>([]);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const measure = () => {
    timer = undefined;
    const root = document.documentElement;
    // Classic scrollbars have arrow buttons (about as tall as the bar is wide) at both ends;
    // the thumb moves between them. Overlay scrollbars (width 0) use the full height.
    const arrow = window.innerWidth - root.clientWidth;
    const track = window.innerHeight - 2 * arrow;
    const scale = track / root.scrollHeight;
    const out: Tick[] = [];
    for (const id of findIds()) {
      const card = document.getElementById(`q-${id}`);
      if (!card) continue;
      // The first highlighted word if the card shows one, else the card itself.
      const target = card.querySelector('mark.find') ?? card;
      out.push({ id, top: arrow + (target.getBoundingClientRect().top + window.scrollY) * scale });
    }
    setTicks(out);
  };
  // Coalesce bursts (typing, cards rendering, sections opening) into one measurement.
  const schedule = () => {
    if (timer === undefined) timer = setTimeout(measure, 50);
  };

  onMount(() => {
    // The page height changes as cards render or sections open and close.
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    window.addEventListener('resize', schedule);
    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      clearTimeout(timer);
    });
  });
  createEffect(on(findIds, schedule));

  return (
    <Show when={findActive()}>
      <div class="find-ruler" aria-hidden="true">
        <For each={ticks()}>
          {(t) => <span classList={{ current: t.id === findCurrentId() }} style={{ top: `${t.top}px` }} />}
        </For>
      </div>
    </Show>
  );
}
