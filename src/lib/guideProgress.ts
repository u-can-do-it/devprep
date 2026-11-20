import { createSignal } from 'solid-js';

const KEY = 'devprep:guides';

/** Per guide (by slug): the chapters marked as known, and the heading the reader was last at. */
type GuideProgress = Record<string, { known?: string[]; at?: string }>;

function load(): GuideProgress {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

const [guideProgress, setGuideProgress] = createSignal<GuideProgress>(load());

function commit(next: GuideProgress) {
  setGuideProgress(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode etc.): guide progress lives for this session only.
  }
}

export const isKnownChapter = (slug: string, chapterId: string) =>
  guideProgress()[slug]?.known?.includes(chapterId) ?? false;

/** Toggle: marking a known chapter again clears it. */
export function toggleKnownChapter(slug: string, chapterId: string) {
  const entry = guideProgress()[slug] ?? {};
  const known = entry.known ?? [];
  const next = known.includes(chapterId) ? known.filter((id) => id !== chapterId) : [...known, chapterId];
  commit({ ...guideProgress(), [slug]: { ...entry, known: next } });
}

/** Id of the heading the reader was last at in this guide; '' = the top. */
export const savedPosition = (slug: string) => guideProgress()[slug]?.at ?? '';

export function savePosition(slug: string, headingId: string) {
  if (!slug || savedPosition(slug) === headingId) return;
  commit({ ...guideProgress(), [slug]: { ...guideProgress()[slug], at: headingId } });
}
