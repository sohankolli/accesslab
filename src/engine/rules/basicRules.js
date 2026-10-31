import { accessibleName } from '../dom/accessibleName.js';
import { cssPath } from '../dom/cssPath.js';

/**
 * Build a serialisable issue (no DOM references, so it can live in Redux).
 * message is a plain title ("The image has no text alternative"), impact says
 * who it affects, and fix.text is short advice. Text in `backticks` is code,
 * shown in the mono font by the UI.
 */
export const issue = (rule, el, message, impact, fix) => ({
  id: `${rule.id}:${cssPath(el)}`,
  ruleId: rule.id,
  severity: rule.severity,
  selector: cssPath(el),
  snippet: el.outerHTML.slice(0, 120),
  message,
  impact,
  fix: typeof fix === 'string' ? { text: fix } : fix, // { text, css? }
  source: sourceRef(el),
});

/**
 * Where the element is among the elements with its tag name, in document order:
 * { tag: 'img', nth: 0 } is the first <img>. The editor uses it to find the
 * element's line in the HTML source (features/editor/sourceLine.js).
 */
function sourceRef(el) {
  const tag = el.localName;
  return { tag, nth: Array.prototype.indexOf.call(el.ownerDocument.getElementsByTagName(tag), el) };
}

/** A form field described in plain words: "email field", "drop-down list". */
function fieldName(el) {
  if (el.tagName === 'SELECT') return 'drop-down list';
  if (el.tagName === 'TEXTAREA') return 'text area';
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  const NAMES = {
    checkbox: 'checkbox',
    radio: 'radio button',
    range: 'slider',
    file: 'file picker',
    color: 'colour picker',
    date: 'date field',
    'datetime-local': 'date and time field',
    tel: 'phone number field',
    url: 'web address field',
  };
  return NAMES[type] ?? `${type} field`;
}

/** A pasted snippet is wrapped by buildDocument() and marked; page-level rules skip it. */
export const isFragment = (doc) => doc.documentElement.hasAttribute('data-al-fragment');

export const imgAlt = {
  id: 'img-alt',
  wcag: '1.1.1 Non-text Content',
  severity: 'critical',
  check({ doc }) {
    return [...doc.querySelectorAll('img:not([alt])')].map((img) =>
      issue(
        imgAlt,
        img,
        'The image has no text alternative',
        'Screen reader users hear "image" and nothing else.',
        'Describe the image in `alt`, or use `alt=""` if it is decoration.',
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
          `The ${fieldName(el)} has no label`,
          !accessibleName(el)
            ? 'Screen reader users are not told what to enter.'
            : el.getAttribute('placeholder')
              ? 'The placeholder disappears as soon as someone types.'
              : 'Its only name is a tooltip, which most people never see.',
          'Add a visible `<label for="…">`, or `aria-label` if a label cannot be shown.',
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
            'A heading level is skipped',
            `The page jumps from h${prev} to h${level}.`,
            `Use an \`h${prev + 1}\` here, or restructure the outline.`,
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
            'The page language is not set',
            'Screen readers may read the text with the wrong pronunciation.',
            'Add `lang="en"` (or the page’s language) to `<html>`.',
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
        title ? 'The page title is empty' : 'The page has no title',
        'Screen reader users and people with many tabs open cannot tell what the page is.',
        'Add a `<title>` inside `<head>` that says what the page is, e.g. `<title>Café Aroma menu</title>`.',
      ),
    ];
  },
};
