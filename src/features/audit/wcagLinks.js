// Links from a rule's WCAG reference to W3C's "Understanding" page for each
// success criterion, which explains who it helps and why.

const UNDERSTANDING = 'https://www.w3.org/WAI/WCAG22/Understanding/';

const SLUGS = {
  '1.1.1': 'non-text-content',
  '1.3.1': 'info-and-relationships',
  '1.4.3': 'contrast-minimum',
  '2.4.1': 'bypass-blocks',
  '2.4.2': 'page-titled',
  '2.4.3': 'focus-order',
  '2.4.4': 'link-purpose-in-context',
  '3.1.1': 'language-of-page',
  '4.1.2': 'name-role-value',
};

/**
 * The success criteria named in a rule's wcag text, with their links.
 * '1.3.1 / 4.1.2 Name, Role, Value' → two entries.
 * @param {string} [wcag]
 * @returns {{number: string, url: string|null}[]}
 */
export function wcagRefs(wcag = '') {
  return [...wcag.matchAll(/\d\.\d\.\d+/g)].map(([number]) => ({
    number,
    url: SLUGS[number] ? UNDERSTANDING + SLUGS[number] : null,
  }));
}

/** Best-practice rules go beyond WCAG; their text says so. */
export const isBestPractice = (wcag = '') => /best practice/i.test(wcag);
