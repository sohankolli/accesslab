// engine/rules/basicRules.js
import { accessibleName } from '../dom/accessibleName.js';
import { cssPath } from '../dom/cssPath.js';

/** Build a serialisable issue (no DOM references, so it can live in Redux). */
export const issue = (rule, el, message, fix) => ({
  id: `${rule.id}:${cssPath(el)}`,
  ruleId: rule.id,
  severity: rule.severity,
  selector: cssPath(el),
  snippet: el.outerHTML.slice(0, 120),
  message,
  fix: typeof fix === 'string' ? { text: fix } : fix, // { text, css? }
});

/** A pasted snippet is wrapped by buildDocument() and marked; page-level rules skip it. */
const isFragment = (doc) => doc.documentElement.hasAttribute('data-al-fragment');

export const imgAlt = {
  id: 'img-alt',
  wcag: '1.1.1 Non-text Content',
  severity: 'critical',
  check({ doc }) {
    return [...doc.querySelectorAll('img:not([alt])')].map((img) =>
      issue(
        imgAlt,
        img,
        'Image has no alt attribute.',
        'Add alt="…" describing the image, or alt="" if it is purely decorative.',
      ),
    );
  },
};

export const formLabel = {
  id: 'form-label',
  wcag: '1.3.1 / 4.1.2 Name, Role, Value',
  severity: 'critical',
  check({ doc }) {
    const fields = doc.querySelectorAll(
      'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), select, textarea',
    );
    return [...fields]
      .filter(
        (el) =>
          !accessibleName(el) ||
          (!el.labels?.length &&
            !el.getAttribute('aria-label') &&
            !el.getAttribute('aria-labelledby')),
      )
      .map((el) =>
        issue(
          formLabel,
          el,
          accessibleName(el)
            ? 'Field is named only by placeholder/title.'
            : 'Form field has no label.',
          'Associate a <label for="id"> or add aria-label.',
        ),
      );
  },
};

export const headingOrder = {
  id: 'heading-order',
  wcag: '1.3.1 Info and Relationships',
  severity: 'moderate',
  check({ doc }) {
    const issues = [];
    let prev = 0;
    for (const h of doc.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
      const level = Number(h.tagName[1]);
      if (prev && level > prev + 1) {
        issues.push(
          issue(
            headingOrder,
            h,
            `Heading level jumps from h${prev} to h${level}.`,
            `Use an h${prev + 1} here, or restructure the outline.`,
          ),
        );
      }
      prev = level;
    }
    return issues;
  },
};

export const htmlLang = {
  id: 'html-lang',
  wcag: '3.1.1 Language of Page',
  severity: 'serious',
  check({ doc }) {
    if (isFragment(doc)) return []; // pasted snippet, not a page
    return doc.documentElement.getAttribute('lang')?.trim()
      ? []
      : [
          issue(
            htmlLang,
            doc.documentElement,
            '<html> has no lang attribute.',
            'Add lang="en" (or the page language).',
          ),
        ];
  },
};

export const pageTitle = {
  id: 'page-title',
  wcag: '2.4.2 Page Titled',
  severity: 'serious',
  check({ doc }) {
    if (isFragment(doc)) return []; // pasted snippet, not a page
    const title = doc.querySelector('title');
    if (title?.textContent.trim()) return [];
    return [
      issue(
        pageTitle,
        title ?? doc.documentElement,
        title ? '<title> is empty.' : 'Page has no <title>.',
        'Add a <title> inside <head> that says what the page is, e.g. <title>Menu · Café</title>.',
      ),
    ];
  },
};
