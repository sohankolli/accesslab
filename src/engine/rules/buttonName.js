import { accessibleName } from '../dom/accessibleName.js';
import { issue } from './basicRules.js';

export const buttonName = {
  id: 'button-name',
  wcag: '4.1.2 Name, Role, Value',
  severity: 'critical',
  check({ doc }) {
    // Submit and reset inputs always have a name ("Submit", "Reset"), so they cannot fail.
    const buttons = doc.querySelectorAll(
      'button, [role="button"], input[type="button"], input[type="image"]',
    );
    return [...buttons]
      .filter((el) => !accessibleName(el) && !(el.tagName === 'INPUT' && el.alt?.trim()))
      .map((el) =>
        issue(
          buttonName,
          el,
          'A button has no name',
          'Screen reader users hear "button" and nothing else.',
          'Put text inside the button, or add `aria-label` (e.g. `aria-label="Close"`) to an icon button.',
        ),
      );
  },
};
