// Production data source: everything in data/ is inlined into the bundle at build time.
import type { RawData } from '../../plugins/data-api.ts';
import questionsCsv from '../../data/questions.csv?raw';
import tagsCsv from '../../data/tags.csv?raw';
import progressCsv from '../../data/progress.csv?raw';

const files = import.meta.glob<string>('../../data/answers/*.md', { query: '?raw', import: 'default', eager: true });

const answers: Record<number, string> = {};
for (const [file, md] of Object.entries(files)) {
  const m = file.match(/(\d+)\.md$/);
  if (m) answers[Number(m[1])] = md;
}

const data: RawData = { questionsCsv, tagsCsv, progressCsv, answers };
export default data;
