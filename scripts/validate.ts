// Checks data/ for consistency. Runs before every build and in CI: `npm run validate`.
import fs from 'node:fs';
import path from 'node:path';
import { answerPath, parseAnswerMd, parseProgress, parseQuestions, parseTags, validateQuestion } from '../src/lib/format.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const problems: string[] = [];

const tags = parseTags(read('data/tags.csv'));
const tagIds = new Set(tags.map((t) => t.id));
if (tagIds.size !== tags.length) problems.push('data/tags.csv: duplicate tag ids');

const answers: Record<number, string> = {};
const answerFiles = fs.readdirSync(path.join(root, 'data/answers')).filter((f) => f.endsWith('.md'));
for (const f of answerFiles) {
  const m = f.match(/^(\d{4})\.md$/);
  if (!m) {
    problems.push(`data/answers/${f}: file name must be a 4-digit id, e.g. 0012.md`);
    continue;
  }
  answers[Number(m[1])] = read(`data/answers/${f}`);
}

const questions = parseQuestions(read('data/questions.csv'), answers);
const seen = new Set<number>();
for (const q of questions) {
  if (seen.has(q.id)) problems.push(`#${q.id}: duplicate id`);
  seen.add(q.id);
  const md = answers[q.id];
  if (md === undefined) {
    problems.push(`#${q.id}: missing ${answerPath(q.id)}`);
    continue;
  }
  if (!/^## Hints[ \t]*$/m.test(md) || !/^## Answer[ \t]*$/m.test(md))
    problems.push(`${answerPath(q.id)}: needs "## Hints" and "## Answer" headings`);
  if (!parseAnswerMd(md).hints.length) problems.push(`${answerPath(q.id)}: warning: no hints`);
  for (const e of validateQuestion(q, tagIds)) problems.push(`#${q.id}: ${e}`);
}
for (const id of Object.keys(answers).map(Number)) {
  if (!seen.has(id)) problems.push(`${answerPath(id)}: no matching row in data/questions.csv`);
}

const progress = parseProgress(read('data/progress.csv'));
for (const id of Object.keys(progress).map(Number)) {
  if (!seen.has(id)) problems.push(`data/progress.csv: warning: unknown question id ${id}`);
}

const errors = problems.filter((p) => !p.includes('warning:'));
for (const p of problems) console.log(p.includes('warning:') ? `  ⚠ ${p}` : `  ✗ ${p}`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s) in data/`);
  process.exit(1);
}
const byLevel = Object.groupBy(questions, (q) => q.level);
console.log(
  `✓ ${questions.length} questions, ${tags.length} tags (` +
    Object.entries(byLevel).map(([l, qs]) => `${l} ${qs?.length}`).join(', ') +
    ')',
);
