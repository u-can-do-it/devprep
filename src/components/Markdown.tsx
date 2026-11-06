import { createEffect, createMemo } from 'solid-js';
import { renderInline, renderMarkdown } from '../lib/markdown.ts';
import { highlight } from '../lib/search.ts';

type Marks = { marks?: string[]; findMarks?: string[] };

/** Renders trusted Markdown HTML, then wraps search matches in <mark> and find-in-list matches in <mark class="find">. */
function useRendered(el: () => HTMLElement | undefined, html: () => string, props: Marks) {
  createEffect(() => {
    const node = el();
    if (!node) return;
    node.innerHTML = html();
    if (props.marks?.length) highlight(node, props.marks);
    if (props.findMarks?.length) highlight(node, props.findMarks, 'find');
  });
}

export function Markdown(props: { src: string; class?: string } & Marks) {
  let ref: HTMLDivElement | undefined;
  const html = createMemo(() => renderMarkdown(props.src));
  useRendered(() => ref, html, props);
  return <div ref={ref} class={`md ${props.class ?? ''}`} />;
}

export function InlineMarkdown(props: { src: string } & Marks) {
  let ref: HTMLSpanElement | undefined;
  const html = createMemo(() => renderInline(props.src));
  useRendered(() => ref, html, props);
  return <span ref={ref} />;
}
