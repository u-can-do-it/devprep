import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { FIGURES } from '../lib/figures.ts';
import { splitFigures } from '../lib/format.ts';
import { isKnownChapter, savedPosition, savePosition, toggleKnownChapter } from '../lib/guideProgress.ts';
import { currentGuide, guides, guideSection, setGuideSection, setGuideSlug } from '../lib/state.ts';
import { InlineMarkdown, Markdown } from './Markdown.tsx';
import { StepGrid } from './StepGrid.tsx';

/** Id of the chapter or section heading the reader has scrolled to; '' above the first chapter. */
const [activeId, setActiveId] = createSignal('');
const [atTop, setAtTop] = createSignal(true);

/** A long-form guide: title, full table of contents, then numbered chapters and sections. */
export function Guide() {
  let root: HTMLElement | undefined;
  // False until the first scroll restore has run, so the position isn't overwritten while mounting.
  let ready = false;

  const slug = () => currentGuide()?.slug ?? '';
  const heading = (id: string) => {
    const el = id ? document.getElementById(id) : null;
    return el && root?.contains(el) ? el : null;
  };
  const knownCount = () => currentGuide()?.chapters.filter((c) => isKnownChapter(slug(), c.id)).length ?? 0;

  onMount(() => {
    let frame = 0;
    // The current heading is the last one that has reached the line under the sticky header.
    const update = () => {
      frame = 0;
      if (!ready) return;
      setAtTop(scrollY < 1);
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

    // In-page links (contents, sidebar, cross-references) scroll without leaving a #hash behind:
    // the reading position lives in ?section=, which follows the scroll.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
      const target = link && heading(decodeURIComponent(link.getAttribute('href')!.slice(1)));
      if (!target) return;
      e.preventDefault();
      // Wait a frame: on small screens the same click closes the contents panel above the text.
      requestAnimationFrame(() => target.scrollIntoView());
    };
    document.addEventListener('click', onClick);

    // Where to open: an explicit #heading link wins, then ?section=, then where the reader left off.
    const restore = () => {
      const fromHash = heading(decodeURIComponent(location.hash.slice(1)));
      const target = fromHash ?? heading(guideSection()) ?? heading(savedPosition(slug()));
      if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);
      if (target) target.scrollIntoView();
      else scrollTo(0, 0);
      ready = true;
      if (!target) setGuideSection('');
      update();
    };
    // Section bodies are filled in after mount, so wait a frame before scrolling.
    let start = requestAnimationFrame(restore);
    // Switching to another guide opens that one where it was left.
    createEffect(
      on(
        slug,
        () => {
          ready = false;
          setGuideSection('');
          cancelAnimationFrame(start);
          start = requestAnimationFrame(restore);
        },
        { defer: true },
      ),
    );

    onCleanup(() => {
      ready = false;
      removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
      sizes.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(start);
      scrollTo(0, 0); // the list shouldn't open at the guide's scroll offset
    });
  });

  // Keep the URL and storage on the section being read, so a reload, a shared link or coming back
  // from the question list lands there.
  createEffect(
    on(
      activeId,
      (id) => {
        if (!ready) return;
        setGuideSection(id);
        savePosition(slug(), id);
      },
      { defer: true },
    ),
  );

  return (
    <Show when={currentGuide()} fallback={<div class="empty">No guides yet. Add one as data/guides/&lt;name&gt;.md.</div>}>
      {(guide) => (
        <article class="guide" ref={root}>
          <header class="guide-head">
            <h1>{guide().title}</h1>
            <Body src={guide().intro} />
          </header>

          <nav class="guide-contents" aria-label="Table of contents">
            <h2>Contents</h2>
            <ol>
              <For each={guide().chapters}>
                {(chapter, i) => (
                  <li classList={{ known: isKnownChapter(slug(), chapter.id) }}>
                    <a href={`#${chapter.id}`}>
                      <span class="guide-n">{i() + 1}</span>
                      <InlineMarkdown src={chapter.title} />
                      <KnownMark slug={slug()} id={chapter.id} />
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
              <section class="guide-chapter" classList={{ known: isKnownChapter(slug(), chapter.id) }}>
                <div class="guide-chapter-head">
                  <h2 id={chapter.id} data-heading>
                    <span class="guide-n">{i() + 1}</span>
                    <InlineMarkdown src={chapter.title} />
                  </h2>
                  <KnownToggle slug={slug()} id={chapter.id} label="I know it" />
                </div>
                <Body src={chapter.intro} />
                <For each={chapter.sections}>
                  {(section, j) => (
                    <section>
                      <h3 id={section.id} data-heading>
                        <span class="guide-n">
                          {i() + 1}.{j() + 1}
                        </span>
                        <InlineMarkdown src={section.title} />
                      </h3>
                      <Body src={section.body} />
                    </section>
                  )}
                </For>
                <div class="guide-chapter-foot">
                  <KnownToggle slug={slug()} id={chapter.id} label="I know this chapter" />
                </div>
              </section>
            )}
          </For>

          <Show when={guide().chapters.length}>
            <KnownCounter known={knownCount()} total={guide().chapters.length} />
          </Show>
        </article>
      )}
    </Show>
  );
}

/** A stretch of guide text: Markdown, with each figure block replaced by the figure it names. */
function Body(props: { src: string }) {
  return (
    <For each={splitFigures(props.src)}>
      {(part) =>
        typeof part === 'string' ? (
          <Markdown src={part} />
        ) : (
          <Show when={FIGURES[part.figure]}>{(figure) => <StepGrid figure={figure()} />}</Show>
        )
      }
    </For>
  );
}

/** Marks a chapter as known; pressing it again clears the mark. */
function KnownToggle(props: { slug: string; id: string; label: string }) {
  return (
    <button
      class="status-known"
      aria-pressed={isKnownChapter(props.slug, props.id)}
      onClick={() => toggleKnownChapter(props.slug, props.id)}
    >
      ✓ {props.label}
    </button>
  );
}

/** The check shown next to a known chapter in a table of contents. */
function KnownMark(props: { slug: string; id: string }) {
  return (
    <Show when={isKnownChapter(props.slug, props.id)}>
      <span class="known-mark" title="Marked as known">
        ✓<span class="sr-only"> known</span>
      </span>
    </Show>
  );
}

/** Floating "3 / 15 known" pill: chapters marked as known, a progress bar, and a back-to-top button. */
function KnownCounter(props: { known: number; total: number }) {
  const toTop = () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div class="list-position known-counter" title="Chapters marked as known">
      <span class="list-position-count">
        <b>{props.known}</b> / {props.total} known
      </span>
      <button class="ghost icon" aria-label="Back to top" title="Back to top" disabled={atTop()} onClick={toTop}>
        ↑
      </button>
      <div class="list-position-bar" aria-hidden="true">
        <div style={{ width: `${(props.known / props.total) * 100}%` }} />
      </div>
    </div>
  );
}

/** Sidebar table of contents: every chapter, with the sections of the one being read. */
export function GuideToc(props: { onNavigate?: () => void }) {
  let nav: HTMLElement | undefined;

  const slug = () => currentGuide()?.slug ?? '';
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
          <select value={slug()} onChange={(e) => setGuideSlug(e.currentTarget.value)}>
            <For each={guides()}>{(g) => <option value={g.slug}>{g.title}</option>}</For>
          </select>
        </div>
      </Show>
      <div class="section">
        <div class="section-title">Contents</div>
        <ol>
          <For each={currentGuide()?.chapters}>
            {(chapter, i) => (
              <li classList={{ current: activeChapter() === chapter.id, known: isKnownChapter(slug(), chapter.id) }}>
                <a href={`#${chapter.id}`} aria-current={activeId() === chapter.id} onClick={props.onNavigate}>
                  <span class="toc-n">{i() + 1}</span>
                  <InlineMarkdown src={chapter.title} />
                  <KnownMark slug={slug()} id={chapter.id} />
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
