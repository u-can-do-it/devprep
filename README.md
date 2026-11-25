# devprep

**Live site: https://u-can-do-it.github.io/devprep/**

Technical interview prep for full-stack developers: 706 questions with hints and Markdown answers,
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
- **Search:** matches the question, tags, hints and answer. Words that don't appear anywhere as typed are matched with typo tolerance (`promsie` finds Promise). Results matching the question come first, then ones that match only in hints or answers (labelled "Matched in answer"). Matches are highlighted. Type `#27` to jump to a question by number, `#23 #24 #494` for several, or `#494-501` (also `#494 - #501`) for a range; numbers combine with words (`#1-100 promise`). Backticks, quotes and brackets around a number are ignored, so ids pasted from Markdown work too.
- **Sorting:** importance, difficulty, date added
- **Preparing for:** pick the interview level (junior, mid, senior, master). Importance, sorting and practice weighting follow it.
- **Hints and answers** are hidden until you open them.
- **Progress:** mark questions as *known* or *review later*, and hide known ones with the toolbar toggle. Stored in your browser; export or import as CSV, or in dev write it to `data/progress.csv`.
- **Bookmarks:** one per category (a question's tag) to keep your place. Bookmarking another question in the same category moves it; the sidebar lists them and jumps back to each. Stored in your browser, as is which hints and answers you left open.
- **Guides:** long-form handbooks next to the question list (the first one is a Next.js interview handbook), with a table of contents that follows your reading position. Mark chapters as *known*; a floating counter shows known / all chapters. The section you are reading is kept in the URL (`&section=…`) and in your browser, so a reload, a shared link or coming back from the list lands where you left off.
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
  guides/nextjs.md  a long-form guide, one Markdown file per guide
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

### Guides

Each file in `data/guides/` is one guide, shown under **Guides** in the header. The file name is its
slug in the URL (`?view=guide&guide=nextjs&section=hydration`).

```md
# Guide title

Intro shown above the table of contents.

## Chapter

Optional chapter intro.

### Section

Markdown. Link to another heading with [text](#heading-id), where the id is the heading in
lowercase with dashes ("Server and Client Components" → `#server-and-client-components`).
```

A guide can also embed an interactive figure with a fenced block whose language is `figure` and whose
only line is the figure's name. Figures are defined as data in `src/lib/figures.ts` (currently a step
grid: rows of steps with a description on hover) and drawn by `src/components/StepGrid.tsx`.

Chapters and sections are numbered automatically. Known chapters and the reading position are stored
in the browser under the heading ids, so renaming a heading forgets them for that heading. Headings must be unique within a guide, in-page
links must point at an existing heading, other links must be absolute, and figures must exist;
`pnpm validate` checks all of these.

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
(`frontend`, `backend`, `security`, `infra`, `design`, `ai`, `soft`, or a new one).

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
