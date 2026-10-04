import { createSignal, Show } from 'solid-js';
import { Editor } from './components/Editor.tsx';
import { Filters } from './components/Filters.tsx';
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
        <aside class="sidebar" classList={{ open: filtersOpen() }} aria-label="Filters">
          <Filters />
        </aside>
        <main>
          <Show when={dataError()}>
            <div class="banner">Couldn't load the question data: {dataError()}</div>
          </Show>
          <Show when={!loading()} fallback={<div class="empty">Loading questions…</div>}>
            <Show when={view() === 'practice'} fallback={<QuestionList />}>
              <Practice />
            </Show>
          </Show>
        </main>
      </div>
      <Show when={editing() !== null}>
        <Editor />
      </Show>
    </>
  );
}
