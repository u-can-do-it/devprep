/** Rendered cards of the question list, in document (= list) order. */
export const listCards = () => document.querySelectorAll<HTMLElement>('main article.card');

/**
 * Index of the first rendered card that hasn't scrolled up past the line under the sticky header,
 * or -1 when no cards are rendered. Cards scrolled into view land at their scroll-margin, so a card
 * counts as "at the top" once it reaches that line.
 */
export function topCardIndex(cards = listCards()): number {
  if (!cards.length) return -1;
  const line = parseFloat(getComputedStyle(cards[0]).scrollMarginTop) || 0;
  let lo = 0;
  let hi = cards.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cards[mid].getBoundingClientRect().bottom > line) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
