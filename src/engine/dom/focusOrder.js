
import { isRendered } from './visibility.js';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
];

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
