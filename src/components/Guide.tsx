import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { currentGuide, guides, setGuideSlug } from '../lib/state.ts';
import { InlineMarkdown, Markdown } from './Markdown.tsx';

/** Id of the chapter or section heading the reader has scrolled to; '' above the first chapter. */
const [activeId, setActiveId] = createSignal('');

const setHash = (id: string) => {
  const hash = id ? `#${id}` : '';
  if (location.hash !== hash) history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
};

/** A long-form guide: title, full table of contents, then numbered chapters and sections. */
export function Guide() {
  let root: HTMLElement | undefined;

  onMount(() => {
    let frame = 0;
    // The current heading is the last one that has reached the line under the sticky header.
    const update = () => {
      frame = 0;
      const headings = root?.querySelectorAll<HTMLElement>('[data-heading]') ?? [];
      if (!headings.length) return;
      const line = parseFloat(getComputedStyle(headings[0]).scrollMarginTop) + 1;
      let current = '';
      for (const h of headings) {
        if (h.getBoundingClientRect().top > line) break;
        current = h.id;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    addEventListener('scroll', onScroll, { passive: true });

    // The sticky header wraps onto more rows on narrow screens; headings must clear its real height.
    const header = document.querySelector<HTMLElement>('.header');
    const sizes = new ResizeObserver(() => root?.style.setProperty('--guide-offset', `${header?.offsetHeight ?? 0}px`));
    if (header) sizes.observe(header);

    // Section bodies are filled in after mount, so wait a frame before jumping to a deep link.
    const start = requestAnimationFrame(() => {
      const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      if (target && root?.contains(target)) target.scrollIntoView();
      else scrollTo(0, 0);
      update();
    });

    onCleanup(() => {
      removeEventListener('scroll', onScroll);
      sizes.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(start);
      setActiveId('');
      setHash('');
      scrollTo(0, 0); // the list shouldn't open at the guide's scroll offset
    });
  });

  // Keep the URL on the section being read, so a reload or a shared link lands there.
  createEffect(on(activeId, setHash, { defer: true }));

  return (
    <Show when={currentGuide()} fallback={<div class="empty">No guides yet. Add one as data/guides/&lt;name&gt;.md.</div>}>
      {(guide) => (
        <article class="guide" ref={root}>
          <header class="guide-head">
            <h1>{guide().title}</h1>
            <Markdown src={guide().intro} />
          </header>

          <nav class="guide-contents" aria-label="Table of contents">
            <h2>Contents</h2>
            <ol>
              <For each={guide().chapters}>
                {(chapter, i) => (
                  <li>
                    <a href={`#${chapter.id}`}>
                      <span class="guide-n">{i() + 1}</span>
                      <InlineMarkdown src={chapter.title} />
                    </a>
                    <ol>
                      <For each={chapter.sections}>
                        {(section) => (
                          <li>
                            <a href={`#${section.id}`}>
                              <InlineMarkdown src={section.title} />
                            </a>
                          </li>
                        )}
                      </For>
                    </ol>
                  </li>
                )}
              </For>
            </ol>
          </nav>

          <For each={guide().chapters}>
            {(chapter, i) => (
              <section class="guide-chapter">
                <h2 id={chapter.id} data-heading>
                  <span class="guide-n">{i() + 1}</span>
                  <InlineMarkdown src={chapter.title} />
                </h2>
                <Show when={chapter.intro}>
                  <Markdown src={chapter.intro} />
                </Show>
                <For each={chapter.sections}>
                  {(section, j) => (
                    <section>
                      <h3 id={section.id} data-heading>
                        <span class="guide-n">
                          {i() + 1}.{j() + 1}
                        </span>
                        <InlineMarkdown src={section.title} />
                      </h3>
                      <Markdown src={section.body} />
                    </section>
                  )}
                </For>
              </section>
            )}
          </For>
        </article>
      )}
    </Show>
  );
}

/** Sidebar table of contents: every chapter, with the sections of the one being read. */
export function GuideToc(props: { onNavigate?: () => void }) {
  let nav: HTMLElement | undefined;

  const activeChapter = () =>
    currentGuide()?.chapters.find((c) => c.id === activeId() || c.sections.some((s) => s.id === activeId()))?.id;

  // Keep the highlighted entry in view while the page scrolls.
  createEffect(
    on(activeId, () => {
      if (nav?.offsetParent) nav.querySelector('a[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
    }),
  );

  return (
    <nav class="toc" ref={nav} aria-label="Guide contents">
      <Show when={guides().length > 1}>
        <div class="section">
          <div class="section-title">Guide</div>
          <select value={currentGuide()?.slug} onChange={(e) => setGuideSlug(e.currentTarget.value)}>
            <For each={guides()}>{(g) => <option value={g.slug}>{g.title}</option>}</For>
          </select>
        </div>
      </Show>
      <div class="section">
        <div class="section-title">Contents</div>
        <ol>
          <For each={currentGuide()?.chapters}>
            {(chapter, i) => (
              <li classList={{ current: activeChapter() === chapter.id }}>
                <a href={`#${chapter.id}`} aria-current={activeId() === chapter.id} onClick={props.onNavigate}>
                  <span class="toc-n">{i() + 1}</span>
                  <InlineMarkdown src={chapter.title} />
                </a>
                <Show when={activeChapter() === chapter.id && chapter.sections.length}>
                  <ol class="toc-sections">
                    <For each={chapter.sections}>
                      {(section) => (
                        <li>
                          <a href={`#${section.id}`} aria-current={activeId() === section.id} onClick={props.onNavigate}>
                            <InlineMarkdown src={section.title} />
                          </a>
                        </li>
                      )}
                    </For>
                  </ol>
                </Show>
              </li>
            )}
          </For>
        </ol>
      </div>
    </nav>
  );
}
