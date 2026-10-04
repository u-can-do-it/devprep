import { createSignal, For, Show } from 'solid-js';
import { isDev } from '../lib/api.ts';
import { LEVELS, LEVEL_LABEL, type Question } from '../lib/format.ts';
import { statusOf, toggleStatus } from '../lib/progress.ts';
import { filters, importanceOf, setEditing, target, toggleIn } from '../lib/state.ts';
import { ImportanceMeter, LevelBadge, TagBadge } from './Badges.tsx';
import { InlineMarkdown, Markdown } from './Markdown.tsx';

export function QuestionCard(props: { q: Question }) {
  // Render Markdown only once a section is first opened; most cards are never expanded.
  const [hintsSeen, setHintsSeen] = createSignal(false);
  const [answerSeen, setAnswerSeen] = createSignal(false);
  const status = () => statusOf(props.q.id);
  const breakdown = () => LEVELS.map((l) => `${LEVEL_LABEL[l]} ${props.q.importance[l]}`).join(' · ');

  return (
    <article id={`q-${props.q.id}`} class="card" classList={{ known: status() === 'known', review: status() === 'review' }}>
      <div class="card-meta">
        <LevelBadge level={props.q.level} />
        <For each={props.q.tags}>
          {(t) => <TagBadge id={t} onClick={() => !filters.tags.includes(t) && toggleIn('tags', t)} />}
        </For>
        <span class="spacer" />
        <ImportanceMeter
          value={importanceOf(props.q)}
          title={`Importance${target() === 'any' ? ' (highest level)' : ` for ${LEVEL_LABEL[target() as keyof typeof LEVEL_LABEL]}`}. ${breakdown()}`}
        />
      </div>

      <h2 class="question-title">
        <InlineMarkdown src={props.q.question} />
      </h2>
      <div class="sub">
        <a href={`#q-${props.q.id}`}>#{props.q.id}</a>
        <span>added {props.q.added}</span>
        <span title="Importance per interview level (0–4)">{breakdown()}</span>
        <Show when={props.q.source}>
          <a href={props.q.source} target="_blank" rel="noopener noreferrer">
            source ↗
          </a>
        </Show>
      </div>

      <div class="reveals">
        <Show when={props.q.hints.length}>
          <details class="reveal" onToggle={(e) => e.currentTarget.open && setHintsSeen(true)}>
            <summary>Hints ({props.q.hints.length})</summary>
            <Show when={hintsSeen()}>
              <ol class="hints">
                <For each={props.q.hints}>
                  {(h) => (
                    <li>
                      <InlineMarkdown src={h} />
                    </li>
                  )}
                </For>
              </ol>
            </Show>
          </details>
        </Show>
        <details class="reveal" onToggle={(e) => e.currentTarget.open && setAnswerSeen(true)}>
          <summary>Show answer</summary>
          <Show when={answerSeen()}>
            <Markdown src={props.q.answer} />
          </Show>
        </details>
      </div>

      <div class="card-actions">
        <button class="status-known" aria-pressed={status() === 'known'} onClick={() => toggleStatus(props.q.id, 'known')}>
          ✓ I know it
        </button>
        <button
          class="status-review"
          aria-pressed={status() === 'review'}
          onClick={() => toggleStatus(props.q.id, 'review')}
        >
          ↻ Review later
        </button>
        <span class="spacer" />
        <Show when={isDev}>
          <button class="ghost" onClick={() => setEditing(props.q.id)}>
            Edit
          </button>
        </Show>
      </div>
    </article>
  );
}
