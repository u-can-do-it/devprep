import { createSignal, For } from 'solid-js';
import { isDev } from '../lib/api.ts';
import { LEVELS, LEVEL_LABEL } from '../lib/format.ts';
import { questions, setTarget, setView, target, view, type Target } from '../lib/state.ts';

type Theme = 'system' | 'light' | 'dark';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'System' },
  { id: 'dark', label: 'Dark' },
];

function readTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : 'system';
}

export function Header(props: { onToggleFilters: () => void }) {
  const [theme, setTheme] = createSignal<Theme>(readTheme());

  const applyTheme = (next: Theme) => {
    setTheme(next);
    if (next === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === 'system') localStorage.removeItem('devprep:theme');
      else localStorage.setItem('devprep:theme', next);
    } catch {}
  };

  return (
    <header class="header">
      <button class="filters-toggle icon" onClick={props.onToggleFilters} aria-label="Toggle filters">
        ☰
      </button>
      <a class="brand" href={import.meta.env.BASE_URL}>
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
        devprep
      </a>
      <span class="count">{questions().length} questions</span>
      {isDev && <span class="dev-badge" title="Editing is enabled because this is the dev server">dev</span>}
      <span class="spacer" />
      <label title="Importance, sorting and practice weighting use this interview level">
        Preparing for
        <select value={target()} onChange={(e) => setTarget(e.currentTarget.value as Target)}>
          <option value="any">Any level</option>
          {LEVELS.map((l) => (
            <option value={l}>{LEVEL_LABEL[l]}</option>
          ))}
        </select>
      </label>
      <div class="segmented" role="group" aria-label="View">
        <button aria-pressed={view() === 'list'} onClick={() => setView('list')}>
          List
        </button>
        <button aria-pressed={view() === 'practice'} onClick={() => setView('practice')}>
          Practice
        </button>
      </div>
      <div class="segmented theme-switch" role="group" aria-label="Theme">
        <span
          class="theme-thumb"
          aria-hidden="true"
          style={{ '--i': THEMES.findIndex((t) => t.id === theme()) }}
        />
        <For each={THEMES}>
          {(t) => (
            <button
              class="icon"
              aria-pressed={theme() === t.id}
              onClick={() => applyTheme(t.id)}
              title={`${t.label} theme`}
              aria-label={`${t.label} theme`}
            >
              <ThemeIcon theme={t.id} />
            </button>
          )}
        </For>
      </div>
    </header>
  );
}

function ThemeIcon(props: { theme: Theme }) {
  const common = { class: 'icon-svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const, 'aria-hidden': true };
  if (props.theme === 'dark') return <svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
  if (props.theme === 'light')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
