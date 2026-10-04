// Dev-only API that reads and writes the files in data/. Not part of the production build.
//
//   GET    /__api/data            raw file contents (same shape the production bundle uses)
//   POST   /__api/questions       create (id 0) or update a question → { id }
//   DELETE /__api/questions/:id   delete a question and its Markdown file
//   PUT    /__api/progress        write data/progress.csv from a Progress object
import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  answerPath,
  parseQuestions,
  parseTags,
  serializeAnswerMd,
  serializeProgress,
  serializeQuestionsCsv,
  validateQuestion,
  type Progress,
  type Question,
} from '../src/lib/format.ts';

export interface RawData {
  questionsCsv: string;
  tagsCsv: string;
  progressCsv: string;
  answers: Record<number, string>;
}

async function readIfExists(file: string) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return '';
  }
}

async function writeAtomic(file: string, content: string) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, file);
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function devprepDataApi(): Plugin {
  let root = process.cwd();
  const file = (rel: string) => path.join(root, rel);

  async function readAll(): Promise<RawData> {
    const answers: Record<number, string> = {};
    const dir = file('data/answers');
    for (const name of await fs.readdir(dir).catch(() => [] as string[])) {
      const m = name.match(/^(\d+)\.md$/);
      if (m) answers[Number(m[1])] = await fs.readFile(path.join(dir, name), 'utf8');
    }
    return {
      questionsCsv: await readIfExists(file('data/questions.csv')),
      tagsCsv: await readIfExists(file('data/tags.csv')),
      progressCsv: await readIfExists(file('data/progress.csv')),
      answers,
    };
  }

  async function upsert(input: Question): Promise<number> {
    const raw = await readAll();
    const questions = parseQuestions(raw.questionsCsv, {});
    const tagIds = new Set(parseTags(raw.tagsCsv).map((t) => t.id));
    const isNew = !input.id;
    const id = isNew ? Math.max(0, ...questions.map((q) => q.id)) + 1 : input.id;
    const q: Question = { ...input, id };

    const errors = validateQuestion(q, tagIds);
    if (errors.length) throw new HttpError(400, errors.join('; '));
    if (!isNew && !questions.some((x) => x.id === id)) throw new HttpError(404, `question ${id} not found`);

    const next = isNew ? [...questions, q] : questions.map((x) => (x.id === id ? q : x));
    await fs.mkdir(file('data/answers'), { recursive: true });
    await writeAtomic(file(answerPath(id)), serializeAnswerMd(q));
    await writeAtomic(file('data/questions.csv'), serializeQuestionsCsv(next));
    return id;
  }

  async function remove(id: number) {
    const raw = await readAll();
    const questions = parseQuestions(raw.questionsCsv, {});
    if (!questions.some((q) => q.id === id)) throw new HttpError(404, `question ${id} not found`);
    await writeAtomic(file('data/questions.csv'), serializeQuestionsCsv(questions.filter((q) => q.id !== id)));
    await fs.rm(file(answerPath(id)), { force: true });
  }

  return {
    name: 'devprep-data-api',
    apply: 'serve',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      // Tell the app to refetch when anything in data/ changes (our writes or hand edits).
      const dataDir = file('data') + path.sep;
      let timer: ReturnType<typeof setTimeout> | undefined;
      server.watcher.on('all', (_event, changed) => {
        if (!changed.startsWith(dataDir) || changed.endsWith('.tmp')) return;
        clearTimeout(timer);
        timer = setTimeout(() => server.ws.send({ type: 'custom', event: 'devprep:data' }), 150);
      });

      server.middlewares.use('/__api', async (req, res) => {
        try {
          const url = req.url ?? '/';
          if (req.method === 'GET' && url === '/data') return send(res, 200, await readAll());
          if (req.method === 'POST' && url === '/questions') {
            return send(res, 200, { id: await upsert((await readBody(req)) as Question) });
          }
          const del = url.match(/^\/questions\/(\d+)$/);
          if (req.method === 'DELETE' && del) {
            await remove(Number(del[1]));
            return send(res, 200, { ok: true });
          }
          if (req.method === 'PUT' && url === '/progress') {
            await writeAtomic(file('data/progress.csv'), serializeProgress((await readBody(req)) as Progress));
            return send(res, 200, { ok: true });
          }
          send(res, 404, { error: 'not found' });
        } catch (e) {
          const status = e instanceof HttpError ? e.status : 500;
          send(res, status, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
