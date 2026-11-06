import { createEffect, createRoot, createSignal, on, untrack, type Accessor } from 'solid-js';

/**
 * A copy of `source` that follows it once it has been quiet for `ms`, so expensive work (search
 * matching) doesn't run on every keystroke. `flush` copies the current value right away and says
 * whether that changed anything.
 */
export function debounced<T>(source: Accessor<T>, ms: number): [value: Accessor<T>, flush: () => boolean] {
  const [value, setValue] = createSignal<T>(untrack(source));
  let timer: ReturnType<typeof setTimeout> | undefined;
  createRoot(() =>
    createEffect(
      on(
        source,
        (v) => {
          clearTimeout(timer);
          timer = setTimeout(() => setValue(() => v), ms);
        },
        { defer: true },
      ),
    ),
  );
  const flush = () => {
    clearTimeout(timer);
    const v = untrack(source);
    if (Object.is(v, untrack(value))) return false;
    setValue(() => v);
    return true;
  };
  return [value, flush];
}
