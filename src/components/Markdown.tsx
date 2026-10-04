import { createEffect, createMemo } from 'solid-js';
import { renderInline, renderMarkdown } from '../lib/markdown.ts';
import { highlight } from '../lib/search.ts';

/** Renders trusted Markdown HTML, then wraps search matches in <mark>. */
function useRendered(el: () => HTMLElement | undefined, html: () => string, marks: () => string[] | undefined) {
  createEffect(() => {
    const node = el();
    if (!node) return;
    node.innerHTML = html();
    const m = marks();
    if (m?.length) highlight(node, m);
  });
}

export function Markdown(props: { src: string; class?: string; marks?: string[] }) {
  let ref: HTMLDivElement | undefined;
  const html = createMemo(() => renderMarkdown(props.src));
  useRendered(() => ref, html, () => props.marks);
  return <div ref={ref} class={`md ${props.class ?? ''}`} />;
}

export function InlineMarkdown(props: { src: string; marks?: string[] }) {
  let ref: HTMLSpanElement | undefined;
  const html = createMemo(() => renderInline(props.src));
  useRendered(() => ref, html, () => props.marks);
  return <span ref={ref} />;
}
