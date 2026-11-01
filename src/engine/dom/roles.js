// Implicit ARIA roles for common elements (subset of the HTML-AAM mapping).
const heading = () => 'heading';
const IMPLICIT = {
  A: (el) => (el.hasAttribute('href') ? 'link' : null),
  BUTTON: () => 'button',
  IMG: (el) => (el.getAttribute('alt') === '' ? 'presentation' : 'img'),
  H1: heading,
  H2: heading,
  H3: heading,
  H4: heading,
  H5: heading,
  H6: heading,
  INPUT: (el) =>
    ({
      checkbox: 'checkbox',
      radio: 'radio',
      submit: 'button',
      button: 'button',
      reset: 'button',
      range: 'slider',
      search: 'searchbox',
      hidden: null,
    })[el.type] ?? 'textbox',
  SELECT: (el) => (el.multiple || el.size > 1 ? 'listbox' : 'combobox'),
  TEXTAREA: () => 'textbox',
  NAV: () => 'navigation',
  MAIN: () => 'main',
  HEADER: () => 'banner', // simplification: only when not inside article/section
  FOOTER: () => 'contentinfo',
  UL: () => 'list',
  OL: () => 'list',
  LI: () => 'listitem',
  FORM: () => 'form',
  TABLE: () => 'table',
};

export function roleOf(el) {
  const explicit = el.getAttribute('role')?.trim().split(/\s+/)[0];
  if (explicit) return explicit;
  return IMPLICIT[el.tagName]?.(el) ?? null;
}
