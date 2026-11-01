import { accessibleName } from './accessibleName.js';
import { roleOf } from './roles.js';
import { isRendered } from './visibility.js';
import { focusOrder } from './focusOrder.js';

const readableName = (element) =>
  accessibleName(element) || 'Unnamed element';

/**
 * Creates a simplified screen-reader outline of a document.
 * This is an educational approximation, not a real screen-reader transcript.
 */
export function linearize(document) {
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .filter(isRendered)
    .filter((element) => !element.closest('[aria-hidden="true"], [inert]'))
    .map((element, index) => ({
      id: `heading-${index}`,
      order: null,
      role: `${element.tagName.toLowerCase()} heading`,
      name: readableName(element),
      state: '',
    }));

  const focusable = focusOrder(document).map((element, index) => ({
    id: `focus-${index}`,
    order: index + 1,
    role: roleOf(element) || element.tagName.toLowerCase(),
    name: readableName(element),
    state: [
      element.disabled ? 'disabled' : '',
      element.getAttribute('aria-expanded') === 'true' ? 'expanded' : '',
      element.getAttribute('aria-checked') !== null
        ? `checked: ${element.getAttribute('aria-checked')}`
        : '',
    ].filter(Boolean).join(', '),
  }));

  const images = [...document.querySelectorAll('img')]
    .filter(isRendered)
    .filter((element) => !element.closest('[aria-hidden="true"], [inert]'))
    .filter((element) => element.getAttribute('alt') !== '')
    .map((element, index) => ({
      id: `image-${index}`,
      order: null,
      role: roleOf(element) || 'image',
      name: accessibleName(element) || 'Image without alt text',
      state: '',
    }));

  return [...headings, ...focusable, ...images];
}
