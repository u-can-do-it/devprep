import { For } from 'solid-js';
import { IMPORTANCE_LABEL, LEVEL_LABEL, type Level } from '../lib/format.ts';
import { tagById } from '../lib/state.ts';

export function LevelBadge(props: { level: Level }) {
  return <span class={`level ${props.level}`}>{LEVEL_LABEL[props.level]}</span>;
}

export function TagBadge(props: { id: string; onClick?: () => void }) {
  return (
    <button type="button" class="tag" onClick={props.onClick} title={props.onClick ? 'Filter by this tag' : undefined}>
      {tagById().get(props.id)?.label ?? props.id}
    </button>
  );
}

/** Four bars, filled up to the importance value (0–4). */
export function ImportanceMeter(props: { value: number; title?: string; showLabel?: boolean }) {
  return (
    <span class="meter" title={props.title} aria-label={`Importance ${props.value} of 4: ${IMPORTANCE_LABEL[props.value]}`}>
      <For each={[1, 2, 3, 4]}>{(n) => <i classList={{ on: n <= props.value }} />}</For>
      {props.showLabel !== false && <span>{IMPORTANCE_LABEL[props.value]}</span>}
    </span>
  );
}
