// engine/rules/landmarkMain.js
import { issue, isFragment } from './basicRules.js';

export const landmarkMain = {
  id: 'landmark-main',
  wcag: 'Best practice (2.4.1 Bypass Blocks)',
  severity: 'minor',
  check({ doc }) {
    if (isFragment(doc)) return []; // pasted snippet, not a page
    const mains = [...doc.querySelectorAll('main, [role="main"]')].filter((el) => !el.hidden);
    if (mains.length === 0) {
      return [
        issue(
          landmarkMain,
          doc.documentElement,
          'Page has no <main> landmark.',
          "Wrap the page's primary content in one <main> element.",
        ),
      ];
    }
    return mains
      .slice(1)
      .map((el) =>
        issue(
          landmarkMain,
          el,
          'Page has more than one <main> landmark.',
          'Keep a single visible <main>; use <section> or <article> for the other regions.',
        ),
      );
  },
};
