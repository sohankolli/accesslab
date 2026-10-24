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
          'Focus jumps out of reading order',
          `Keyboard users reach this element early because of \`tabindex="${el.getAttribute('tabindex').trim()}"\`.`,
          'Use `tabindex="0"` (or remove it) and move the element to where it belongs in the source.',
        ),
      );
  },
};
