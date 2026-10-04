import { createEffect, createMemo, createResource, createRoot, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { loadRaw } from './api.ts';
import { LEVELS, parseProgress, parseQuestions, parseTags, type Level, type Question, type Tag } from './format.ts';
import { mergeProgress, progress } from './progress.ts';

// ---------- data ----------

// Module-level reactive state lives in its own roots for the lifetime of the page.
const [raw, { refetch }] = createRoot(() => createResource(loadRaw));
export { refetch as reloadData };

if (import.meta.hot) import.meta.hot.on('devprep:data', () => refetch());

const parsed = createRoot(() =>
  createMemo<{ questions: Question[]; tags: Tag[]; error?: string }>(() => {
  const r = raw.latest;
  if (!r) return { questions: [], tags: [] };
  try {
    return { questions: parseQuestions(r.questionsCsv, r.answers), tags: parseTags(r.tagsCsv) };
  } catch (e) {
    return { questions: [], tags: [], error: e instanceof Error ? e.message : String(e) };
  }
  }),
);

export const questions = () => parsed().questions;
export const tags = () => parsed().tags;
export const loading = () => raw.loading && !raw.latest;
export const dataError = () => parsed().error ?? (raw.error ? String(raw.error) : undefined);

// Progress committed to the repo (data/progress.csv) seeds this browser; newer local entries win.
createRoot(() =>
  createEffect(() => {
    const r = raw.latest;
    if (r) mergeProgress(parseProgress(r.progressCsv));
  }),
);

export const tagById = createRoot(() => createMemo(() => new Map(tags().map((t) => [t.id, t]))));

// ---------- filters (mirrored in the URL) ----------

export type Target = Level | 'any';
export type SortKey = 'importance' | 'difficulty-asc' | 'difficulty-desc' | 'newest' | 'oldest';
export type ProgressFilter = 'all' | 'unseen' | 'review' | 'known' | 'hide-known';
export type View = 'list' | 'practice';

export interface Filters {
  search: string;
  levels: Level[];
  tags: string[];
  tagMode: 'any' | 'all';
  minImp: number;
  progress: ProgressFilter;
  sort: SortKey;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  levels: [],
  tags: [],
  tagMode: 'any',
  minImp: 0,
  progress: 'all',
  sort: 'importance',
};

const TARGET_KEY = 'devprep:target';
const isTarget = (v: unknown): v is Target => v === 'any' || LEVELS.includes(v as Level);

function readUrl() {
  const p = new URLSearchParams(location.search);
  const list = (k: string) => (p.get(k) ?? '').split(',').filter(Boolean);
  let storedTarget: string | null = null;
  try {
    storedTarget = localStorage.getItem(TARGET_KEY);
  } catch {}
  const target = [p.get('target'), storedTarget].find(isTarget) ?? 'any';
  const filters: Filters = {
    search: p.get('q') ?? '',
    levels: list('lvl').filter((l): l is Level => LEVELS.includes(l as Level)),
    tags: list('tags'),
    tagMode: p.get('match') === 'all' ? 'all' : 'any',
    minImp: Math.min(4, Math.max(0, Number(p.get('imp') ?? 0) || 0)),
    progress: (p.get('progress') as ProgressFilter) ?? 'all',
    sort: (p.get('sort') as SortKey) ?? 'importance',
  };
  if (!['all', 'unseen', 'review', 'known', 'hide-known'].includes(filters.progress)) filters.progress = 'all';
  if (!['importance', 'difficulty-asc', 'difficulty-desc', 'newest', 'oldest'].includes(filters.sort))
    filters.sort = 'importance';
  return { filters, target, view: (p.get('view') === 'practice' ? 'practice' : 'list') as View };
}

const initial = readUrl();
export const [filters, setFilters] = createStore<Filters>(initial.filters);
export const [target, setTargetSignal] = createSignal<Target>(initial.target);
export const [view, setView] = createSignal<View>(initial.view);

export function setTarget(t: Target) {
  setTargetSignal(t);
  try {
    localStorage.setItem(TARGET_KEY, t);
  } catch {}
}

export const resetFilters = () => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort });
export const hasActiveFilters = () =>
  !!filters.search || !!filters.levels.length || !!filters.tags.length || filters.minImp > 0 || filters.progress !== 'all';

export function toggleIn<K extends 'levels' | 'tags'>(key: K, value: Filters[K][number]) {
  const cur = filters[key] as string[];
  setFilters(key, (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]) as Filters[K]);
}

createRoot(() => createEffect(() => {
  const p = new URLSearchParams();
  if (filters.search) p.set('q', filters.search);
  if (filters.levels.length) p.set('lvl', filters.levels.join(','));
  if (filters.tags.length) p.set('tags', filters.tags.join(','));
  if (filters.tagMode === 'all') p.set('match', 'all');
  if (filters.minImp) p.set('imp', String(filters.minImp));
  if (filters.progress !== 'all') p.set('progress', filters.progress);
  if (filters.sort !== 'importance') p.set('sort', filters.sort);
  if (target() !== 'any') p.set('target', target());
  if (view() === 'practice') p.set('view', 'practice');
  const qs = p.toString().replace(/%2C/g, ',');
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}));

// ---------- derived ----------

/** How likely the question is at the chosen interview level (any = the highest of the four). */
export const importanceOf = (q: Question, t: Target = target()) =>
  t === 'any' ? Math.max(...LEVELS.map((l) => q.importance[l])) : q.importance[t];

const levelRank = (l: Level) => LEVELS.indexOf(l);

const haystacks = createRoot(() => createMemo(
  () =>
    new Map(
      questions().map((q) => [q.id, [q.question, q.tags.join(' '), q.hints.join(' '), q.answer].join('\n').toLowerCase()]),
    ),
));

export const filtered = createRoot(() => createMemo(() => {
  const f = filters;
  const terms = f.search.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = haystacks();
  const prog = progress();
  const t = target();

  const list = questions().filter((q) => {
    if (f.levels.length && !f.levels.includes(q.level)) return false;
    if (f.tags.length) {
      const match = f.tagMode === 'all' ? f.tags.every((x) => q.tags.includes(x)) : f.tags.some((x) => q.tags.includes(x));
      if (!match) return false;
    }
    if (importanceOf(q, t) < f.minImp) return false;
    const status = prog[q.id]?.status ?? null;
    if (f.progress === 'unseen' && status) return false;
    if (f.progress === 'review' && status !== 'review') return false;
    if (f.progress === 'known' && status !== 'known') return false;
    if (f.progress === 'hide-known' && status === 'known') return false;
    if (terms.length) {
      const h = hay.get(q.id) ?? '';
      if (!terms.every((term) => h.includes(term))) return false;
    }
    return true;
  });

  const byLevel = (a: Question, b: Question) => levelRank(a.level) - levelRank(b.level);
  const byDate = (a: Question, b: Question) => a.added.localeCompare(b.added) || a.id - b.id;
  const cmp: Record<SortKey, (a: Question, b: Question) => number> = {
    importance: (a, b) => importanceOf(b, t) - importanceOf(a, t) || byLevel(a, b) || a.id - b.id,
    'difficulty-asc': (a, b) => byLevel(a, b) || importanceOf(b, t) - importanceOf(a, t) || a.id - b.id,
    'difficulty-desc': (a, b) => byLevel(b, a) || importanceOf(b, t) - importanceOf(a, t) || a.id - b.id,
    newest: (a, b) => byDate(b, a),
    oldest: byDate,
  };
  return list.sort(cmp[f.sort]);
}));

// ---------- editor ----------

/** null = closed, 'new' = adding, number = editing that id. */
export const [editing, setEditing] = createSignal<number | 'new' | null>(null);
