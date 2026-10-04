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
