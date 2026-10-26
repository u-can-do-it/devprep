import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { isDev, saveProgressToRepo } from '../lib/api.ts';
import { bookmarks, removeBookmark } from '../lib/bookmarks.ts';
import { IMPORTANCE_LABEL, LEVELS, LEVEL_LABEL, parseProgress, serializeProgress } from '../lib/format.ts';
import { mergeProgress, progress } from '../lib/progress.ts';
import {
  filtered,
  filters,
  hasActiveFilters,
  jumpTo,
  questions,
  resetFilters,
  setFilters,
  tags,
  toggleIn,
  type ProgressFilter,
} from '../lib/state.ts';

const GROUP_LABEL: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  security: 'Security',
  infra: 'Infra and tooling',
  design: 'Architecture',
  ai: 'AI',
  coding: 'Coding',
  soft: 'Soft skills',
};

export function Filters() {
  const levelCounts = createMemo(() => {
    const c: Record<string, number> = {};
    for (const q of questions()) c[q.level] = (c[q.level] ?? 0) + 1;
    return c;
  });
  const tagCounts = createMemo(() => {
    const c: Record<string, number> = {};
    for (const q of questions()) for (const t of q.tags) c[t] = (c[t] ?? 0) + 1;
    return c;
  });
  const groups = createMemo(() => {
    const out = new Map<string, typeof tags extends () => infer T ? T : never>();
    for (const t of tags()) out.set(t.group, [...(out.get(t.group) ?? []), t]);
    return [...out.entries()];
  });

  // The search box grows with its content, so long queries like `#476 #479 #541-559` stay readable.
  let searchEl!: HTMLTextAreaElement;
  const fitSearch = () => {
    searchEl.style.height = 'auto';
    searchEl.style.height = `${searchEl.scrollHeight + searchEl.offsetHeight - searchEl.clientHeight}px`;
  };
  createEffect(on(() => filters.search, fitSearch));
  onMount(() => {
    // Re-fit when the width changes (window resize, the mobile sidebar opening), not on our own height changes.
    let width = 0;
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === width) return;
      width = entry.contentRect.width;
      fitSearch();
    });
    ro.observe(searchEl);
    onCleanup(() => ro.disconnect());
  });

  return (
    <div>
      <div class="section">
        <div class="section-title">
          <label for="search">Search</label>
          <Show when={hasActiveFilters()}>
            <button class="linkish" onClick={resetFilters}>
              Reset all
            </button>
          </Show>
        </div>
        <textarea
          id="search"
          ref={searchEl}
          class="search"
          rows={1}
          enterkeyhint="search"
          spellcheck={false}
          placeholder="closure, CORS, #27, #494-501"
          value={filters.search}
          onInput={(e) => setFilters('search', e.currentTarget.value)}
          onKeyDown={(e) => {
            // Still a one-line search: Enter adds no line break, Escape clears like a native search input.
            if (e.key === 'Enter') e.preventDefault();
            else if (e.key === 'Escape' && filters.search) setFilters('search', '');
          }}
        />
      </div>

      <BookmarkList />

      <div class="section">
        <div class="section-title">Difficulty</div>
        <div class="chips">
          <For each={LEVELS}>
            {(l) => (
              <button class="chip" aria-pressed={filters.levels.includes(l)} onClick={() => toggleIn('levels', l)}>
                {LEVEL_LABEL[l]} <span class="n">{levelCounts()[l] ?? 0}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          Tags
          <button
            class="linkish"
            onClick={() => setFilters('tagMode', filters.tagMode === 'any' ? 'all' : 'any')}
            title="Show questions matching any selected tag, or only those that have all of them"
          >
            match {filters.tagMode}
          </button>
        </div>
        <For each={groups()}>
          {([group, list]) => (
            <>
              <div class="group-label">{GROUP_LABEL[group] ?? group}</div>
              <div class="chips">
                <For each={list}>
                  {(t) => (
                    <button class="chip" aria-pressed={filters.tags.includes(t.id)} onClick={() => toggleIn('tags', t.id)}>
                      {t.label} <span class="n">{tagCounts()[t.id] ?? 0}</span>
                    </button>
                  )}
                </For>
              </div>
            </>
          )}
        </For>
      </div>

      <div class="section">
        <div class="section-title">
          <label for="min-imp">Min importance</label>
        </div>
        <div class="range-row">
          <input
            id="min-imp"
            type="range"
            min="0"
            max="4"
            step="1"
            value={filters.minImp}
            onInput={(e) => setFilters('minImp', Number(e.currentTarget.value))}
          />
          <output>{filters.minImp === 0 ? 'any' : `${IMPORTANCE_LABEL[filters.minImp]}+`}</output>
        </div>
        <ImportanceHelp />
      </div>

      <div class="section">
        <div class="section-title">
          <label for="progress-filter">Progress</label>
        </div>
        <select
          id="progress-filter"
          value={filters.progress}
          onChange={(e) => setFilters('progress', e.currentTarget.value as ProgressFilter)}
        >
          <option value="all">All questions</option>
          <option value="unseen">Not marked yet</option>
          <option value="review">To review</option>
          <option value="known">Known</option>
          <option value="hide-known">Hide known</option>
        </select>
      </div>

      <ProgressPanel />
    </div>
  );
}

/** One bookmark per category, in sidebar tag order. Hidden until something is bookmarked. */
function BookmarkList() {
  const list = createMemo(() => {
    const marks = bookmarks();
    const byId = new Map(questions().map((q) => [q.id, q]));
    return tags().flatMap((t) => {
      const q = marks[t.id] === undefined ? undefined : byId.get(marks[t.id]);
      return q ? [{ tag: t, q }] : [];
    });
  });

  return (
    <Show when={list().length}>
      <div class="section">
        <div class="section-title">Bookmarks</div>
        <ul class="bookmarks">
          <For each={list()}>
            {({ tag, q }) => (
              <li>
                <button class="bookmark-link" onClick={() => jumpTo(q.id, tag.id)} title={`Show ${tag.label} and scroll to #${q.id}`}>
                  <span class="bookmark-tag">{tag.label}</span>
                  <span class="bookmark-q">
                    #{q.id} {q.question.replace(/[`*_]/g, '')}
                  </span>
                </button>
                <button class="ghost icon" onClick={() => removeBookmark(tag.id)} aria-label={`Remove the ${tag.label} bookmark`}>
                  ×
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  );
}

function ImportanceHelp() {
  return (
    <details class="help">
      <summary>How importance works</summary>
      <p>
        Every question has four scores (0–4): how likely it comes up in a junior, mid, senior or master
        interview. A basic question like <code>==</code> vs <code>===</code> is very likely for juniors and
        almost never asked of seniors.
      </p>
      <p>
        "Preparing for" in the header picks which score is used for this filter, for sorting, and for practice
        weighting. "Any level" uses the highest of the four.
      </p>
      <table>
        <thead>
          <tr>
            <th>0</th>
            <th>1</th>
            <th>2</th>
            <th>3</th>
            <th>4</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <For each={IMPORTANCE_LABEL}>{(l) => <td>{l}</td>}</For>
          </tr>
        </tbody>
      </table>
    </details>
  );
}

function ProgressPanel() {
  const [msg, setMsg] = createSignal('');
  let fileInput!: HTMLInputElement;

  const counts = createMemo(() => {
    const p = progress();
    let known = 0;
    let review = 0;
    for (const q of filtered()) {
      const s = p[q.id]?.status;
      if (s === 'known') known++;
      else if (s === 'review') review++;
    }
    return { known, review, total: filtered().length };
  });

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3000);
  };

  const exportCsv = () => {
    const blob = new Blob([serializeProgress(progress())], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'progress.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importCsv = async (file: File) => {
    try {
      const incoming = parseProgress(await file.text());
      mergeProgress(incoming);
      flash(`Imported ${Object.keys(incoming).length} entries`);
    } catch (e) {
      flash(`Couldn't read that file: ${e instanceof Error ? e.message : e}`);
    }
  };

  const saveToRepo = async () => {
    try {
      await saveProgressToRepo(progress());
      flash('Saved to data/progress.csv');
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div class="section">
      <div class="section-title">Your progress</div>
      <div class="stats">
        <div class="stat known">
          <b>{counts().known}</b>
          <span>known</span>
        </div>
        <div class="stat review">
          <b>{counts().review}</b>
          <span>to review</span>
        </div>
        <div class="stat">
          <b>{counts().total - counts().known - counts().review}</b>
          <span>not marked</span>
        </div>
      </div>
      <div class="btn-col">
        <button onClick={exportCsv}>Export CSV</button>
        <button onClick={() => fileInput.click()}>Import CSV</button>
        <Show when={isDev}>
          <button onClick={saveToRepo} title="Write your progress to data/progress.csv so it's committed with the repo">
            Save to repo
          </button>
        </Show>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) importCsv(f);
          e.currentTarget.value = '';
        }}
      />
      <p class="note">{msg() || 'Counts are for the current filters. Progress is stored in this browser.'}</p>
    </div>
  );
}
