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
          'The page has no main landmark',
          'Keyboard and screen reader users cannot jump straight to the content.',
          'Wrap the page’s primary content in one `<main>` element.',
        ),
      ];
    }
    return mains
      .slice(1)
      .map((el) =>
        issue(
          landmarkMain,
          el,
          'The page has more than one main landmark',
          'Screen reader users cannot tell which one holds the content.',
          'Keep one visible `<main>`; use `<section>` or `<article>` for the other regions.',
        ),
      );
  },
};
