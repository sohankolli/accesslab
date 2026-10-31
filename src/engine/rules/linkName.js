import { accessibleName } from '../dom/accessibleName.js';
import { issue } from './basicRules.js';

export const linkName = {
  id: 'link-name',
  wcag: '2.4.4 Link Purpose (In Context)',
  severity: 'serious',
  check({ doc }) {
    return [...doc.querySelectorAll('a[href], [role="link"]')]
      .filter((el) => !accessibleName(el))
      .map((el) =>
        issue(
          linkName,
          el,
          'A link has no name',
          'Screen reader users hear "link" with no idea where it goes.',
          'Put text inside the link, give its image an `alt`, or add `aria-label` (e.g. `aria-label="Cart"`).',
        ),
      );
  },
};
