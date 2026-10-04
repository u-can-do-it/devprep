import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { deleteQuestion, saveQuestion } from '../lib/api.ts';
import {
  IMPORTANCE_LABEL,
  LEVELS,
  LEVEL_LABEL,
  SUGGESTED_IMPORTANCE,
  validateQuestion,
  type Level,
  type Question,
} from '../lib/format.ts';
import { editing, questions, reloadData, setEditing, tags } from '../lib/state.ts';
import { Markdown } from './Markdown.tsx';

const today = () => new Date().toISOString().slice(0, 10);

interface Draft {
  question: string;
  level: Level;
  tags: string[];
  importance: Record<Level, number>;
  hintsText: string;
  answer: string;
  added: string;
  source: string;
}

export function Editor() {
  const id = editing() === 'new' ? 0 : (editing() as number);
  const existing = questions().find((q) => q.id === id);

  const [draft, setDraft] = createStore<Draft>(
    existing
      ? {
          question: existing.question,
          level: existing.level,
          tags: [...existing.tags],
          importance: { ...existing.importance },
          hintsText: existing.hints.join('\n'),
          answer: existing.answer,
          added: existing.added,
          source: existing.source,
        }
      : {
          question: '',
          level: 'junior',
          tags: [],
          importance: { ...SUGGESTED_IMPORTANCE.junior },
          hintsText: '',
          answer: '',
          added: today(),
          source: '',
        },
  );
  const [preview, setPreview] = createSignal(false);
  const [errors, setErrors] = createSignal<string[]>([]);
  const [saving, setSaving] = createSignal(false);
  let dialog!: HTMLDialogElement;

  onMount(() => dialog.showModal());

  const toQuestion = (): Question => ({
    id,
    question: draft.question.trim(),
    level: draft.level,
    tags: [...draft.tags],
    importance: { ...draft.importance },
    added: draft.added,
    source: draft.source.trim(),
    hints: draft.hintsText
      .split('\n')
      .map((h) => h.replace(/^\s*[-*]\s+/, '').trim())
      .filter(Boolean),
    answer: draft.answer.trim(),
  });

  const tagGroups = createMemo(() => {
    const out = new Map<string, { id: string; label: string }[]>();
    for (const t of tags()) out.set(t.group, [...(out.get(t.group) ?? []), t]);
    return [...out.values()];
  });

  const close = () => setEditing(null);

  const save = async () => {
    const q = toQuestion();
    // id 0 means "new"; the server assigns the real one, so validate with a placeholder.
    const errs = validateQuestion({ ...q, id: q.id || 1 }, new Set(tags().map((t) => t.id)));
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    try {
      const { id: savedId } = await saveQuestion(q);
      await reloadData();
      close();
      if (!id) requestAnimationFrame(() => document.getElementById(`q-${savedId}`)?.scrollIntoView({ block: 'center' }));
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete question #${id}? This removes its row and data/answers file.`)) return;
    try {
      await deleteQuestion(id);
      await reloadData();
      close();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    }
  };

  const toggleTag = (t: string) =>
    setDraft('tags', (cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <dialog
      ref={dialog}
      class="editor"
      onClose={close}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          save();
        }
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div class="editor-head">
          <h2>{id ? `Edit question #${id}` : 'Add question'}</h2>
          <button type="button" class="ghost icon" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <div class="editor-body">
          <div class="field">
            <label for="ed-question">
              Question <span class="hint">Markdown inline, e.g. `code`</span>
            </label>
            <input
              id="ed-question"
              type="text"
              value={draft.question}
              onInput={(e) => setDraft('question', e.currentTarget.value)}
              placeholder="What's the difference between `==` and `===`?"
              autofocus
            />
          </div>

          <div class="row">
            <div class="field">
              <label for="ed-level">Difficulty</label>
              <select id="ed-level" value={draft.level} onChange={(e) => setDraft('level', e.currentTarget.value as Level)}>
                <For each={LEVELS}>{(l) => <option value={l}>{LEVEL_LABEL[l]}</option>}</For>
              </select>
            </div>
            <div class="field">
              <label for="ed-added">Added</label>
              <input id="ed-added" type="date" value={draft.added} onInput={(e) => setDraft('added', e.currentTarget.value)} />
            </div>
            <div class="field">
              <label for="ed-source">
                Source <span class="hint">optional</span>
              </label>
              <input
                id="ed-source"
                type="url"
                value={draft.source}
                onInput={(e) => setDraft('source', e.currentTarget.value)}
                placeholder="https://developer.mozilla.org/…"
              />
            </div>
          </div>

          <div class="field">
            <div class="label">
              Importance per interview level
              <button type="button" class="linkish" onClick={() => setDraft('importance', { ...SUGGESTED_IMPORTANCE[draft.level] })}>
                Suggest from difficulty
              </button>
            </div>
            <div class="imp-grid">
              <For each={LEVELS}>
                {(l) => (
                  <label>
                    {LEVEL_LABEL[l]}
                    <select
                      value={draft.importance[l]}
                      onChange={(e) => setDraft('importance', l, Number(e.currentTarget.value))}
                    >
                      <For each={[0, 1, 2, 3, 4]}>
                        {(n) => (
                          <option value={n}>
                            {n} · {IMPORTANCE_LABEL[n]}
                          </option>
                        )}
                      </For>
                    </select>
                  </label>
                )}
              </For>
            </div>
          </div>

          <div class="field">
            <div class="label">
              Tags <span class="hint">{draft.tags.length} selected</span>
            </div>
            <For each={tagGroups()}>
              {(group) => (
                <div class="chips">
                  <For each={group}>
                    {(t) => (
                      <button type="button" class="chip" aria-pressed={draft.tags.includes(t.id)} onClick={() => toggleTag(t.id)}>
                        {t.label}
                      </button>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>

          <div class="field">
            <label for="ed-hints">
              Hints <span class="hint">one helper question per line</span>
            </label>
            <textarea
              id="ed-hints"
              class="mono"
              rows="3"
              value={draft.hintsText}
              onInput={(e) => setDraft('hintsText', e.currentTarget.value)}
              placeholder="What does type coercion mean?"
            />
          </div>

          <div class="field">
            <div class="label">
              <label for="ed-answer">Answer (Markdown)</label>
              <span class="segmented" role="group">
                <button type="button" aria-pressed={!preview()} onClick={() => setPreview(false)}>
                  Write
                </button>
                <button type="button" aria-pressed={preview()} onClick={() => setPreview(true)}>
                  Preview
                </button>
              </span>
            </div>
            <Show
              when={preview()}
              fallback={
                <textarea
                  id="ed-answer"
                  class="mono"
                  rows="14"
                  value={draft.answer}
                  onInput={(e) => setDraft('answer', e.currentTarget.value)}
                />
              }
            >
              <div class="preview">
                <Markdown src={draft.answer || '_Nothing to preview yet._'} />
              </div>
            </Show>
          </div>

          <Show when={errors().length}>
            <ul class="errors" role="alert">
              <For each={errors()}>{(e) => <li>{e}</li>}</For>
            </ul>
          </Show>
        </div>

        <div class="editor-foot">
          <Show when={id}>
            <button type="button" class="danger" onClick={remove}>
              Delete
            </button>
          </Show>
          <span class="spacer" />
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" class="primary" disabled={saving()} title="Ctrl+Enter">
            {saving() ? 'Saving…' : 'Save to CSV'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
