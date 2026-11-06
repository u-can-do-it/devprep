import { createEffect, createSignal, on, onCleanup, onMount } from 'solid-js';
import { listCards, topCardIndex } from '../lib/viewport.ts';

/**
 * Floating "12 / 87" pill: which card of the current (filtered, sorted) list is at the top of the
 * viewport, a progress bar through the list, and a back-to-top button.
 */
export function ListPosition(props: { total: number; rendered: number }) {
  const [current, setCurrent] = createSignal(1);
  const [atTop, setAtTop] = createSignal(true);
  let frame = 0;

  const measure = () => {
    frame = 0;
    setAtTop(window.scrollY < 1);
    const cards = listCards();
    if (!cards.length) return;
    const root = document.documentElement;
    if (props.rendered >= props.total && window.scrollY + window.innerHeight >= root.scrollHeight - 1) {
      // At the very bottom the last cards can never reach the top; show the end of the list.
      setCurrent(props.total);
      return;
    }
    setCurrent(topCardIndex(cards) + 1);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };

  onMount(() => {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    onCleanup(() => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    });
  });
  // Re-measure when the list changes (filters, sort, hide-known, next page rendered).
  createEffect(on(() => [props.total, props.rendered], schedule));

  const position = () => Math.min(current(), props.total);
  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div class="list-position" title="Position in the current list">
      <span class="list-position-count">
        <b>{position()}</b> / {props.total}
      </span>
      <button class="ghost icon" aria-label="Back to top" title="Back to top" disabled={atTop()} onClick={toTop}>
        ↑
      </button>
      <div class="list-position-bar" aria-hidden="true">
        <div style={{ width: `${(position() / props.total) * 100}%` }} />
      </div>
    </div>
  );
}
