// Search: exact substring first, typo-tolerant word match as a fallback.
// Results are tiered so questions whose title matches come before ones that only match in hints/answer.
import type { Question } from './format.ts';

export type Field = 'question' | 'tags' | 'hints' | 'answer';

export interface SearchEntry {
  fields: Record<Field, string>;
  words: Record<Field, Set<string>>;
}

export interface SearchMatch {
  /** 0 = every term in the question (exact), 1 = in the question with typos, 2 = only in tags/hints/answer. */
  tier: 0 | 1 | 2;
  /** Strings to highlight: the typed terms (exact hits) and the words they fuzzily matched. */
  marks: string[];
  /** Fields outside the question title that matched, for "matched in answer" labels. */
  matchedIn: Field[];
}

const FIELDS: Field[] = ['question', 'tags', 'hints', 'answer'];
const WORD = /[\p{L}\p{N}]+/gu;

const normalize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
const wordsOf = (s: string) => new Set(s.match(WORD) ?? []);

export function buildEntry(q: Question, tagLabels: string[]): SearchEntry {
  const fields: Record<Field, string> = {
    question: normalize(q.question),
    tags: normalize([...q.tags, ...tagLabels].join(' ')),
    hints: normalize(q.hints.join('\n')),
    answer: normalize(q.answer),
  };
  const words = Object.fromEntries(FIELDS.map((f) => [f, wordsOf(fields[f])])) as SearchEntry['words'];
  return { fields, words };
}

/** Search terms: lowercased, deduplicated; single characters are ignored (they match nearly everything). */
export function parseQuery(query: string): string[] {
  return [...new Set(normalize(query).split(/\s+/).filter((t) => t.length > 1))];
}

/**
 * Terms that appear nowhere as typed are probably typos; only those get fuzzy matching.
 * A real word like "cors" then matches exactly instead of also hitting "core" or "cost".
 */
export function typoTerms(terms: string[], entries: Iterable<SearchEntry>): Set<string> {
  const missing = new Set(terms);
  for (const e of entries) {
    for (const t of missing) if (FIELDS.some((f) => e.fields[f].includes(t))) missing.delete(t);
    if (!missing.size) break;
  }
  return missing;
}

/** Optimal string alignment distance (Levenshtein + adjacent transpositions), capped at max + 1. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = [new Array<number>(b.length + 1).fill(0).map((_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1);
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1; // the whole row is already too far
    rows.push(row);
  }
  return rows[a.length][b.length];
}

/** How many typos a term may contain. */
const allowedTypos = (term: string) => (term.length >= 8 ? 2 : term.length >= 3 ? 1 : 0);

/** Words in the set that the term matches with typos, either as a whole word or as a word prefix. */
function fuzzyWords(term: string, words: Set<string>): string[] {
  const max = allowedTypos(term);
  if (!max || !/^[\p{L}\p{N}]+$/u.test(term)) return [];
  const hits: string[] = [];
  for (const w of words) {
    if (w.length < 3) continue;
    const whole = distance(term, w, max) <= max;
    // Prefix matching ("promsi" → "promises") only for longer terms; short ones would match too much.
    const prefix = term.length >= 5 && w.length > term.length && distance(term, w.slice(0, term.length), max) <= max;
    if (whole || prefix) hits.push(w);
  }
  return hits;
}

type TermHit = { exact: boolean; marks: string[] };

function matchTerm(term: string, entry: SearchEntry, field: Field, fuzzy: boolean): TermHit | null {
  if (entry.fields[field].includes(term)) return { exact: true, marks: [term] };
  if (!fuzzy) return null;
  const words = fuzzyWords(term, entry.words[field]);
  return words.length ? { exact: false, marks: words } : null;
}

export function matchEntry(entry: SearchEntry, terms: string[], typos: Set<string>): SearchMatch | null {
  if (!terms.length) return { tier: 0, marks: [], matchedIn: [] };

  const titleHits = terms.map((t) => matchTerm(t, entry, 'question', typos.has(t)));
  if (titleHits.every(Boolean)) {
    const hits = titleHits as TermHit[];
    return { tier: hits.every((h) => h.exact) ? 0 : 1, marks: hits.flatMap((h) => h.marks), matchedIn: [] };
  }

  // Not all terms are in the title: every term must still be found somewhere.
  const marks: string[] = [];
  const matchedIn = new Set<Field>();
  for (const term of terms) {
    let found = false;
    for (const field of FIELDS) {
      const hit = matchTerm(term, entry, field, typos.has(term));
      if (!hit) continue;
      found = true;
      marks.push(...hit.marks);
      if (field !== 'question') matchedIn.add(field);
    }
    if (!found) return null;
  }
  return { tier: 2, marks, matchedIn: FIELDS.filter((f) => matchedIn.has(f)) };
}

/** Wrap occurrences of marks in <mark> inside an element's text nodes (case-insensitive). */
export function highlight(root: HTMLElement, marks: string[]) {
  const unique = [...new Set(marks.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!unique.length) return;
  const re = new RegExp(unique.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const node of nodes) {
    const text = node.data;
    re.lastIndex = 0;
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(re)) {
      const i = m.index ?? 0;
      if (i > last) frag.append(text.slice(last, i));
      const mark = document.createElement('mark');
      mark.textContent = m[0];
      frag.append(mark);
      last = i + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}
