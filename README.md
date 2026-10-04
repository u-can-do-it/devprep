# devprep

Technical interview prep for full-stack developers: 150 questions with hints and Markdown answers,
filterable by tag, difficulty and how likely they are to come up at your interview level.

No backend and no accounts. Questions live in this repo as CSV and Markdown; you edit them locally and push.

```bash
pnpm install
pnpm dev           # http://localhost:5173, editing enabled
pnpm build         # validate data, type-check, build to dist/
pnpm validate      # only check data/
```

## Features

- **Filters:** full-text search (question, hints and answer), difficulty, tags (match any or all), minimum importance, progress
- **Sorting:** importance, difficulty, date added
- **Preparing for:** pick the interview level (junior, mid, senior, master). Importance, sorting and practice weighting follow it.
- **Hints and answers** are hidden until you open them.
- **Progress:** mark questions as *known* or *review later*. Stored in your browser; export or import as CSV, or in dev write it to `data/progress.csv`.
- **Practice mode:** flashcards from the current filters, shuffled with weights (important and "review" questions come first). Keys: `H` hint, `A`/`Space` answer, `K` knew it, `R` review, `S` skip, `←` back.
- **Editor** (dev server only): add, edit and delete questions from the UI. It writes straight to `data/`.
- Filters live in the URL, so any view can be bookmarked or shared.

## Data

```
data/
  questions.csv     one row per question (metadata)
  answers/0012.md   hints + answer for question 12
  tags.csv          tag id, label, sidebar group
  progress.csv      optional: your progress, committed to the repo
```

### `questions.csv`

| column | meaning |
|---|---|
| `id` | integer, unique; the answer file is `answers/<id as 4 digits>.md` |
| `question` | one line, inline Markdown allowed (`` `code` ``) |
| `level` | difficulty: `junior`, `mid`, `senior`, `master` |
| `tags` | tag ids separated by `\|`, e.g. `security\|be-security` |
| `imp_junior` … `imp_master` | importance 0–4 at each interview level (see below) |
| `added` | `YYYY-MM-DD` |
| `source` | optional URL |

### Answer files

```md
## Hints

- A helper question that nudges toward the answer?
- Another one?

## Answer

Markdown, with fenced code blocks (```js, ```python, ```sql, ...).
```

### Importance

Difficulty and importance are separate. Every question has four scores: how likely it is to come up in a
junior, mid, senior or master interview.

| score | meaning |
|---|---|
| 0 | not relevant |
| 1 | rare |
| 2 | sometimes |
| 3 | often |
| 4 | almost always |

`==` vs `===` is a junior question scored `4 3 1 0`: almost certain at a junior interview, rarely asked of
a senior. Designing a rate limiter is `0 1 4 4`. In the editor, "Suggest from difficulty" fills in the
defaults below; adjust them to how often the question really comes up.

| difficulty | junior | mid | senior | master |
|---|---|---|---|---|
| junior | 4 | 3 | 1 | 0 |
| mid | 2 | 4 | 3 | 1 |
| senior | 0 | 2 | 4 | 3 |
| master | 0 | 0 | 2 | 4 |

### Tags

Add a row to `data/tags.csv`. `group` decides which sidebar section the tag is listed under
(`frontend`, `backend`, `security`, `infra`, `design`, `soft`, or a new one).

### Editing by hand

You can also edit the files directly. In dev the app reloads data when anything in `data/` changes.
Run `pnpm validate` before pushing; CI runs it too.

## How it works

- Vite + SolidJS + TypeScript. PapaParse for CSV, marked + highlight.js for answers.
- **Dev:** a small Vite plugin (`plugins/data-api.ts`) serves and writes `data/` through `/__api/*`.
- **Production:** `data/` is bundled into static files at build time. There's no editor and no API.
- `src/lib/format.ts` is the single definition of the data format, shared by the app, the dev API and the validator.

## Deploy

`.github/workflows/deploy.yml` validates, builds and publishes to GitHub Pages on every push to `main`.
Enable it once under *Settings → Pages → Source: GitHub Actions*.

Progress committed in `data/progress.csv` is merged into each visitor's browser on load (the newer entry wins).
If the site is public and you'd rather keep that private, don't commit the file with entries.
