const KEY = 'devprep:open';

export type Section = 'hints' | 'answer';

/** Question id → the sections left open on its card. Closed sections aren't stored. */
type Expanded = Record<number, Section[]>;

function load(): Expanded {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

// Read once and written through; nothing reacts to it, so it needn't be a signal.
let expanded = load();

export const isOpen = (id: number, section: Section) => expanded[id]?.includes(section) ?? false;

export function setOpen(id: number, section: Section, open: boolean) {
  if (isOpen(id, section) === open) return;
  const rest = (expanded[id] ?? []).filter((s) => s !== section);
  const next = open ? [...rest, section] : rest;
  expanded = { ...expanded };
  if (next.length) expanded[id] = next;
  else delete expanded[id];
  try {
    localStorage.setItem(KEY, JSON.stringify(expanded));
  } catch {
    // Storage unavailable: open sections are remembered for this session only.
  }
}
