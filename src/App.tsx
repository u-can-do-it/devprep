import { createSignal, Match, Show, Switch } from 'solid-js';
import { Editor } from './components/Editor.tsx';
import { Filters } from './components/Filters.tsx';
import { Guide, GuideToc } from './components/Guide.tsx';
import { Header } from './components/Header.tsx';
import { Practice } from './components/Practice.tsx';
import { QuestionList } from './components/QuestionList.tsx';
import { dataError, editing, loading, view } from './lib/state.ts';

export default function App() {
  const [filtersOpen, setFiltersOpen] = createSignal(false);

  return (
    <>
      <Header onToggleFilters={() => setFiltersOpen((v) => !v)} />
      <div class="layout">
        <aside class="sidebar" classList={{ open: filtersOpen() }} aria-label={view() === 'guide' ? 'Guide contents' : 'Filters'}>
          <Show when={view() === 'guide'} fallback={<Filters />}>
            <GuideToc onNavigate={() => setFiltersOpen(false)} />
          </Show>
        </aside>
        <main>
          <Show when={dataError()}>
            <div class="banner">Couldn't load the question data: {dataError()}</div>
          </Show>
          <Show when={!loading()} fallback={<div class="empty">Loading questions…</div>}>
            <Switch fallback={<QuestionList />}>
              <Match when={view() === 'practice'}>
                <Practice />
              </Match>
              <Match when={view() === 'guide'}>
                <Guide />
              </Match>
            </Switch>
          </Show>
        </main>
      </div>
      <Show when={editing() !== null}>
        <Editor />
      </Show>
    </>
  );
}
