// Shared data format: used by the app, the dev API plugin and scripts/validate.ts.
// Keep it free of DOM and Vite-specific APIs so plain Node can import it.
import Papa from 'papaparse';

export const LEVELS = ['junior', 'mid', 'senior', 'master'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<Level, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  master: 'Master',
};

export const IMPORTANCE_LABEL = ['not relevant', 'rare', 'sometimes', 'often', 'almost always'] as const;

/** Default importance per interview level, by question difficulty. Used by the editor's "suggest". */
export const SUGGESTED_IMPORTANCE: Record<Level, Record<Level, number>> = {
  junior: { junior: 4, mid: 3, senior: 1, master: 0 },
  mid: { junior: 2, mid: 4, senior: 3, master: 1 },
  senior: { junior: 0, mid: 2, senior: 4, master: 3 },
  master: { junior: 0, mid: 0, senior: 2, master: 4 },
};

export interface Tag {
  id: string;
  label: string;
  group: string;
}

export interface Question {
  id: number;
  question: string;
  level: Level;
  tags: string[];
  importance: Record<Level, number>;
  added: string;
  source: string;
  /** Helper questions, each a Markdown fragment. */
  hints: string[];
  /** Markdown. */
  answer: string;
}

export type ProgressStatus = 'known' | 'review';

export interface ProgressEntry {
  /** null = explicitly cleared (kept so a merge doesn't bring an old status back). */
  status: ProgressStatus | null;
  /** ISO timestamp. */
  updated: string;
}

export type Progress = Record<number, ProgressEntry>;

export const QUESTION_COLUMNS = [
  'id',
  'question',
  'level',
  'tags',
  'imp_junior',
  'imp_mid',
  'imp_senior',
  'imp_master',
  'added',
  'source',
] as const;

export const answerPath = (id: number) => `data/answers/${String(id).padStart(4, '0')}.md`;

function parseCsv(text: string): Record<string, string>[] {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  if (res.errors.length) {
    const e = res.errors[0];
    throw new Error(`CSV parse error (row ${e.row}): ${e.message}`);
  }
  return res.data;
}

export function parseTags(csv: string): Tag[] {
  return parseCsv(csv).map((r) => ({ id: r.id.trim(), label: r.label.trim(), group: r.group.trim() }));
}

export function parseAnswerMd(md: string): { hints: string[]; answer: string } {
  const text = md.replace(/\r\n/g, '\n');
  const answerAt = text.search(/^## Answer[ \t]*$/m);
  const hintsBlock = answerAt === -1 ? text : text.slice(0, answerAt);
  const answer = answerAt === -1 ? '' : text.slice(answerAt).replace(/^## Answer[ \t]*\n/, '').trim();

  const hints: string[] = [];
  for (const line of hintsBlock.replace(/^## Hints[ \t]*$/m, '').split('\n')) {
    const item = line.match(/^[-*]\s+(.*)$/);
    if (item) hints.push(item[1].trim());
    else if (line.trim() && hints.length) hints[hints.length - 1] += ' ' + line.trim();
  }
  return { hints, answer };
}

export function serializeAnswerMd(q: Pick<Question, 'hints' | 'answer'>): string {
  const hints = q.hints.map((h) => h.trim()).filter(Boolean);
  return `## Hints\n\n${hints.map((h) => `- ${h}`).join('\n')}${hints.length ? '\n\n' : ''}## Answer\n\n${q.answer.trim()}\n`;
}

/** answers: id → raw Markdown file contents. */
export function parseQuestions(csv: string, answers: Record<number, string>): Question[] {
  return parseCsv(csv).map((r) => {
    const id = Number(r.id);
    const md = answers[id];
    return {
      id,
      question: r.question.trim(),
      level: r.level.trim() as Level,
      tags: r.tags.split('|').map((t) => t.trim()).filter(Boolean),
      importance: {
        junior: Number(r.imp_junior),
        mid: Number(r.imp_mid),
        senior: Number(r.imp_senior),
        master: Number(r.imp_master),
      },
      added: r.added.trim(),
      source: (r.source ?? '').trim(),
      ...(md ? parseAnswerMd(md) : { hints: [], answer: '' }),
    };
  });
}

export function serializeQuestionsCsv(questions: Question[]): string {
  const rows = [...questions]
    .sort((a, b) => a.id - b.id)
    .map((q) => [
      q.id,
      q.question,
      q.level,
      q.tags.join('|'),
      q.importance.junior,
      q.importance.mid,
      q.importance.senior,
      q.importance.master,
      q.added,
      q.source,
    ]);
  // Always quote the question column so hand edits with commas stay safe.
  const quotes = QUESTION_COLUMNS.map((c) => c === 'question');
  const body = Papa.unparse(rows, { quotes, newline: '\n' });
  return `${QUESTION_COLUMNS.join(',')}\n${body}\n`;
}

export function parseProgress(csv: string): Progress {
  const out: Progress = {};
  if (!csv.trim()) return out;
  for (const r of parseCsv(csv)) {
    const status = r.status === 'known' || r.status === 'review' ? r.status : null;
    if (status) out[Number(r.id)] = { status, updated: r.updated };
  }
  return out;
}

export function serializeProgress(progress: Progress): string {
  const data = Object.entries(progress)
    .filter(([, e]) => e.status)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, e]) => [id, e.status, e.updated]);
  return Papa.unparse({ fields: ['id', 'status', 'updated'], data }, { newline: '\n' }) + '\n';
}

/** Problems with a question, as human-readable strings. Empty = valid. */
export function validateQuestion(q: Question, tagIds: Set<string>): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(q.id) || q.id < 1) errs.push(`invalid id "${q.id}"`);
  if (!q.question) errs.push('question is empty');
  if (!LEVELS.includes(q.level)) errs.push(`unknown level "${q.level}"`);
  if (!q.tags.length) errs.push('needs at least one tag');
  for (const t of q.tags) if (!tagIds.has(t)) errs.push(`unknown tag "${t}"`);
  for (const l of LEVELS) {
    const v = q.importance[l];
    if (!Number.isInteger(v) || v < 0 || v > 4) errs.push(`imp_${l} must be an integer 0–4`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.added)) errs.push(`added must be YYYY-MM-DD, got "${q.added}"`);
  if (!q.answer) errs.push('answer is empty');
  return errs;
}

// ---------- guides ----------

export interface GuideSection {
  id: string;
  /** Inline Markdown. */
  title: string;
  /** Markdown. */
  body: string;
}

export interface GuideChapter {
  id: string;
  /** Inline Markdown. */
  title: string;
  /** Markdown before the first section. */
  intro: string;
  sections: GuideSection[];
}

export interface Guide {
  /** File name without `.md`; used in the URL. */
  slug: string;
  title: string;
  /** Markdown before the first chapter. */
  intro: string;
  chapters: GuideChapter[];
}

export const guidePath = (slug: string) => `data/guides/${slug}.md`;

/** Anchor for a heading: "Server & Client `Components`" → "server-client-components". */
export const headingId = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const isFence = (line: string) => /^\s*(```|~~~)/.test(line);

/** Markdown with fenced blocks and inline code removed, so code isn't mistaken for links. */
function withoutCode(md: string): string {
  let fenced = false;
  const prose = md.split('\n').filter((line) => {
    if (isFence(line)) {
      fenced = !fenced;
      return false;
    }
    return !fenced;
  });
  return prose.join('\n').replace(/`[^`\n]*`/g, '');
}

/**
 * A guide is one Markdown file: `# Title`, an intro, then `## Chapter` headings, each split into
 * `### Section` headings. Headings inside fenced code blocks are left alone, and a heading id that
 * repeats gets a numeric suffix so every anchor is unique.
 */
export function parseGuide(slug: string, md: string): Guide {
  const guide: Guide = { slug, title: '', intro: '', chapters: [] };
  const used = new Map<string, number>();
  const uniqueId = (title: string) => {
    const id = headingId(title) || 'section';
    const n = (used.get(id) ?? 0) + 1;
    used.set(id, n);
    return n === 1 ? id : `${id}-${n}`;
  };

  let chapter: GuideChapter | undefined;
  let section: GuideSection | undefined;
  let buffer: string[] = [];
  let fenced = false;
  const flush = () => {
    const text = buffer.join('\n').trim();
    buffer = [];
    if (section) section.body = text;
    else if (chapter) chapter.intro = text;
    else guide.intro = text;
  };

  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (isFence(line)) fenced = !fenced;
    const heading = fenced ? null : line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (!heading || (heading[1] === '###' && !chapter)) {
      buffer.push(line);
      continue;
    }
    const title = heading[2];
    if (heading[1] === '#') {
      if (!guide.title && !chapter) guide.title = title;
      else buffer.push(line);
      continue;
    }
    flush();
    if (heading[1] === '##') {
      chapter = { id: uniqueId(title), title, intro: '', sections: [] };
      section = undefined;
      guide.chapters.push(chapter);
    } else {
      section = { id: uniqueId(title), title, body: '' };
      chapter!.sections.push(section);
    }
  }
  flush();
  return guide;
}

/** Problems with a guide, as human-readable strings. Empty = valid. */
export function validateGuide(g: Guide): string[] {
  const errs: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug)) errs.push('file name must be lowercase letters, digits and dashes');
  if (!g.title) errs.push('needs a "# Title" line');
  if (!g.chapters.length) errs.push('needs at least one "## Chapter"');

  const headings = g.chapters.flatMap((c) => [c, ...c.sections]);
  const ids = new Set(headings.map((h) => h.id));
  const titles = new Set<string>();
  for (const h of headings) {
    const key = headingId(h.title);
    if (titles.has(key)) errs.push(`heading "${h.title}" repeats; anchors must be unique`);
    titles.add(key);
  }

  // Links: in-page anchors must exist, everything else must be absolute.
  const bodies = [g.intro, ...g.chapters.flatMap((c) => [c.intro, ...c.sections.map((s) => s.body)])];
  for (const body of bodies) {
    for (const [, href] of withoutCode(body).matchAll(/\]\(([^)\s]+)\)/g)) {
      if (href.startsWith('#')) {
        if (!ids.has(href.slice(1))) errs.push(`link to "${href}" has no matching heading`);
      } else if (!/^https?:\/\//.test(href)) errs.push(`link "${href}" must start with http(s):// or #`);
    }
  }
  return errs;
}
