import { createUniqueId, For, Show } from 'solid-js';
import type { StepGridFigure } from '../lib/figures.ts';

/**
 * A figure for guides: one row per subject, one column per phase, read left to right.
 * Every tile shows a longer description under its row on hover, focus or tap. The description is
 * a sibling of the tile, so styles.css can show it with `:hover + .steps-tip` and no script.
 */
export function StepGrid(props: { figure: StepGridFigure }) {
  // Escape dismisses the description of the focused tile.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && e.target instanceof HTMLElement) e.target.blur();
  };
  const columns = () => props.figure.columns;

  return (
    <figure
      class="steps"
      aria-label={props.figure.title}
      style={{ '--steps-cols': columns().length }}
      onKeyDown={onKeyDown}
    >
      <div class="steps-row steps-head">
        <span class="steps-corner" aria-hidden="true" />
        <For each={columns()}>
          {(column, i) => <Tile kind="steps-col" title={`${i() + 1}. ${column.title}`} heading={column.title} tip={column.tip} />}
        </For>
      </div>
      <For each={props.figure.rows}>
        {(row) => (
          <div class="steps-row">
            <Tile kind="steps-name" title={row.name} note={row.note} heading={row.name} tip={row.tip} />
            <For each={row.steps}>
              {(step, j) => (
                <Tile
                  kind="steps-step"
                  title={step.title}
                  note={step.note}
                  heading={`${row.name} · ${columns()[j()]?.title.toLowerCase() ?? ''}`}
                  tip={step.tip}
                  highlight={step.highlight}
                  arrow={j() < row.steps.length - 1}
                />
              )}
            </For>
          </div>
        )}
      </For>
      <figcaption class="steps-legend">
        <span>
          <i class="steps-swatch" aria-hidden="true" />
          {props.figure.legend}
        </span>
        <span>Hover or tap a tile for details</span>
      </figcaption>
    </figure>
  );
}

function Tile(props: {
  kind: string;
  title: string;
  note?: string;
  /** Title of the description. */
  heading: string;
  tip: string;
  highlight?: boolean;
  /** Draw an arrow to the next step. */
  arrow?: boolean;
}) {
  const tipId = createUniqueId();
  return (
    <>
      <div
        class={`steps-tile ${props.kind}`}
        classList={{ highlight: props.highlight, arrow: props.arrow }}
        tabindex="0"
        aria-describedby={tipId}
      >
        <b>{props.title}</b>
        <Show when={props.note}>
          <span>{props.note}</span>
        </Show>
      </div>
      <div class="steps-tip" role="tooltip" id={tipId}>
        <b>{props.heading}</b>
        {props.tip}
      </div>
    </>
  );
}
