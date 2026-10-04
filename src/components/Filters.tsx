import { createMemo, createSignal, For, Show } from 'solid-js';
import { isDev, saveProgressToRepo } from '../lib/api.ts';
import { IMPORTANCE_LABEL, LEVELS, LEVEL_LABEL, parseProgress, serializeProgress } from '../lib/format.ts';
import { mergeProgress, progress } from '../lib/progress.ts';
import {
  filtered,
  filters,
  hasActiveFilters,
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
        <input
          id="search"
          type="search"
          placeholder="closure, CORS, JWT"
          value={filters.search}
          onInput={(e) => setFilters('search', e.currentTarget.value)}
        />
      </div>

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
        <div class="stat">
          <b style={{ color: 'var(--known)' }}>{counts().known}</b>
          <span>known</span>
        </div>
        <div class="stat">
          <b style={{ color: 'var(--review)' }}>{counts().review}</b>
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
