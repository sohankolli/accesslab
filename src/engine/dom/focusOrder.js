
import { isRendered } from './visibility.js';

/** Elements that can take keyboard focus without a script (a subset of HTML's rules). */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
];

/**
 * The order in which the Tab key visits a page's elements: first every element
 * with a positive tabindex, by tabindex value (ties in document order), then
 * every other focusable element in document order. Leaves out elements that
 * are disabled, have tabindex="-1", are not rendered, or sit inside hidden,
 * inert or aria-hidden="true" content. An approximation of browser behaviour.
 * @param {Document} document  the page to inspect
 * @returns {Element[]}  focusable elements in tab order
 */
export function focusOrder(document) {
  const candidates = [...document.querySelectorAll(FOCUSABLE.join(','))]
    .filter((element) => {
      if (element.closest('[hidden], [inert], [aria-hidden="true"]')) {
        return false;
      }

      if (!isRendered(element)) return false;

      return element.tabIndex >= 0;
    });

  return candidates
    .map((element, domOrder) => ({
      element,
      domOrder,
      tabIndex: element.tabIndex,
    }))
    .sort((a, b) => {
      const aPositive = a.tabIndex > 0;
      const bPositive = b.tabIndex > 0;

      if (aPositive && bPositive) {
        return a.tabIndex - b.tabIndex || a.domOrder - b.domOrder;
      }

      if (aPositive) return -1;
      if (bPositive) return 1;

      return a.domOrder - b.domOrder;
    })
    .map(({ element }) => element);
}
