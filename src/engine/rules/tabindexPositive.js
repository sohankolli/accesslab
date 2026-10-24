// engine/rules/tabindexPositive.js
import { issue } from './basicRules.js';

export const tabindexPositive = {
  id: 'tabindex-positive',
  wcag: '2.4.3 Focus Order (best practice)',
  severity: 'moderate',
  check({ doc }) {
    return [...doc.querySelectorAll('[tabindex]')]
      .filter((el) => parseInt(el.getAttribute('tabindex'), 10) > 0)
      .map((el) =>
        issue(
          tabindexPositive,
          el,
          `tabindex="${el.getAttribute('tabindex').trim()}" moves this element ahead of the natural focus order.`,
          'Use tabindex="0" (or remove it) and put the element where it belongs in the source order.',
        ),
      );
  },
};
