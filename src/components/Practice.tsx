import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { ProgressStatus, Question } from '../lib/format.ts';
import { progress, setStatus, statusOf } from '../lib/progress.ts';
import { editing, filtered, importanceOf, questions, setView } from '../lib/state.ts';
import { ImportanceMeter, LevelBadge, TagBadge } from './Badges.tsx';
import { InlineMarkdown, Markdown } from './Markdown.tsx';

/**
 * Weighted shuffle (Efraimidis–Spirakis): higher weight → more likely to come early.
 * Weight grows with importance for the chosen level, doubles for "to review", and drops for "known".
 */
function weightedOrder(list: Question[]): number[] {
  const p = progress();
  return list
    .map((q) => {
      const s = p[q.id]?.status;
      const w = (importanceOf(q) + 0.5) * (s === 'review' ? 2 : s === 'known' ? 0.35 : 1);
      return { id: q.id, key: Math.random() ** (1 / w) };
    })
    .sort((a, b) => b.key - a.key)
    .map((x) => x.id);
}

export function Practice() {
  const [queue, setQueue] = createSignal<number[]>([]);
  const [pos, setPos] = createSignal(0);
  const [hintsShown, setHintsShown] = createSignal(0);
  const [answerShown, setAnswerShown] = createSignal(false);
  const [results, setResults] = createSignal<Record<number, ProgressStatus | 'skipped'>>({});

  const byId = createMemo(() => new Map(questions().map((q) => [q.id, q])));
  const current = () => byId().get(queue()[pos()]);
  const done = () => queue().length > 0 && pos() >= queue().length;

  const start = () => {
    setQueue(weightedOrder(filtered()));
    setPos(0);
    setResults({});
    resetCard();
  };
  const resetCard = () => {
    setHintsShown(0);
    setAnswerShown(false);
  };
  const go = (delta: number) => {
    setPos((p) => Math.max(0, Math.min(queue().length, p + delta)));
    resetCard();
  };
  const rate = (r: ProgressStatus | 'skipped') => {
    const q = current();
    if (!q) return;
    if (r !== 'skipped') setStatus(q.id, r);
    setResults((x) => ({ ...x, [q.id]: r }));
    go(1);
  };
  const nextHint = () => {
    const q = current();
    if (q && hintsShown() < q.hints.length) setHintsShown((n) => n + 1);
  };

  const tally = createMemo(() => {
    const t = { known: 0, review: 0, skipped: 0 };
    for (const r of Object.values(results())) t[r]++;
    return t;
  });

  onMount(() => {
    start();
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (editing() !== null || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el.closest('input, textarea, select, [contenteditable]')) return;
      const actions: Record<string, () => void> = {
        h: nextHint,
        a: () => setAnswerShown(true),
        ' ': () => setAnswerShown((v) => !v),
        k: () => rate('known'),
        r: () => rate('review'),
        s: () => rate('skipped'),
        ArrowRight: () => go(1),
        ArrowLeft: () => go(-1),
      };
      const fn = actions[e.key];
      if (fn && !done()) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  return (
    <div class="practice">
      <div class="toolbar">
        <span class="results">
          Practice · {queue().length} {queue().length === 1 ? 'question' : 'questions'} from your filters
        </span>
        <span class="spacer" />
        <button onClick={start}>Reshuffle</button>
        <button class="ghost" onClick={() => setView('list')}>
          Back to list
        </button>
      </div>
      <div class="progressbar" aria-hidden="true">
        <div style={{ width: `${queue().length ? (pos() / queue().length) * 100 : 0}%` }} />
      </div>

      <Show when={queue().length} fallback={<div class="empty">No questions match your filters. Loosen them and reshuffle.</div>}>
        <Show
          when={!done() && current()}
          fallback={
            <div class="card summary">
              <h2>Round finished</h2>
              <div class="stats">
                <div class="stat known">
                  <b>{tally().known}</b>
                  <span>knew it</span>
                </div>
                <div class="stat review">
                  <b>{tally().review}</b>
                  <span>to review</span>
                </div>
                <div class="stat">
                  <b>{tally().skipped}</b>
                  <span>skipped</span>
                </div>
              </div>
              <button class="primary" onClick={start}>
                Start another round
              </button>
            </div>
          }
        >
          {(q) => (
            <article class="card">
              <div class="card-meta">
                <span class="sub">
                  {pos() + 1} / {queue().length}
                </span>
                <LevelBadge level={q().level} />
                <For each={q().tags}>{(t) => <TagBadge id={t} />}</For>
                <span class="spacer" />
                <ImportanceMeter value={importanceOf(q())} />
              </div>
              <h2 class="question-title">
                <InlineMarkdown src={q().question} />
              </h2>
              <Show when={statusOf(q().id)}>
                {(s) => (
                  <p class="sub practice-status">
                    Previously marked {s() === 'known' ? 'known' : 'to review'}
                  </p>
                )}
              </Show>

              <Show when={hintsShown() > 0}>
                <div class="practice-section">
                  <h3>Hints</h3>
                  <ol class="hints">
                    <For each={q().hints.slice(0, hintsShown())}>
                      {(h) => (
                        <li>
                          <InlineMarkdown src={h} />
                        </li>
                      )}
                    </For>
                  </ol>
                </div>
              </Show>
              <Show when={answerShown()}>
                <div class="practice-section">
                  <h3>Answer</h3>
                  <Markdown src={q().answer} />
                </div>
              </Show>

              <div class="practice-controls">
                <Show when={hintsShown() < q().hints.length}>
                  <button onClick={nextHint}>
                    Next hint ({hintsShown() + 1}/{q().hints.length})
                  </button>
                </Show>
                <button onClick={() => setAnswerShown((v) => !v)}>{answerShown() ? 'Hide answer' : 'Reveal answer'}</button>
              </div>
              <div class="practice-controls rating">
                <button class="status-known" aria-pressed="true" onClick={() => rate('known')}>
                  ✓ Knew it
                </button>
                <button class="status-review" aria-pressed="true" onClick={() => rate('review')}>
                  ↻ Review again
                </button>
                <button onClick={() => rate('skipped')}>Skip</button>
                <span class="spacer" />
                <button class="ghost" disabled={pos() === 0} onClick={() => go(-1)} aria-label="Previous question">
                  ←
                </button>
              </div>
            </article>
          )}
        </Show>
      </Show>

      <p class="kbd-help">
        <kbd>H</kbd> hint · <kbd>A</kbd>/<kbd>Space</kbd> answer · <kbd>K</kbd> knew it · <kbd>R</kbd> review ·{' '}
        <kbd>S</kbd> skip · <kbd>←</kbd> back
      </p>
    </div>
  );
}
