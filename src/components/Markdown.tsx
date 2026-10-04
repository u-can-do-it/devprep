import { createMemo } from 'solid-js';
import { renderInline, renderMarkdown } from '../lib/markdown.ts';

export function Markdown(props: { src: string; class?: string }) {
  const html = createMemo(() => renderMarkdown(props.src));
  return <div class={`md ${props.class ?? ''}`} innerHTML={html()} />;
}

export function InlineMarkdown(props: { src: string }) {
  const html = createMemo(() => renderInline(props.src));
  return <span innerHTML={html()} />;
}
