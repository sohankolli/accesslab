import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { accessibleName } from '../../src/engine/dom/accessibleName';
import { linearize } from '../../src/engine/dom/linearize';

const doc = (body) =>
  new JSDOM(`<!doctype html><html><head><title>T</title></head><body>${body}</body></html>`).window
    .document;
const nameOf = (body) => accessibleName(doc(body).body.firstElementChild);

describe('accessibleName: name from content', () => {
  it('names a role="heading" element from its text, like a real <h2>', () => {
    expect(nameOf('<div role="heading" aria-level="2">Pricing</div>')).toBe('Pricing');
    expect(nameOf('<h2>Pricing</h2>')).toBe('Pricing');
  });

  it.each([
    ['button', '<span role="button">Save</span>', 'Save'],
    ['link', '<span role="link">Home</span>', 'Home'],
    ['tab', '<div role="tab">Details</div>', 'Details'],
    ['menuitem', '<li role="menuitem">Open</li>', 'Open'],
    ['option', '<div role="option">Red</div>', 'Red'],
    ['checkbox', '<div role="checkbox" aria-checked="false">Agree</div>', 'Agree'],
    ['switch', '<div role="switch" aria-checked="true">Wi-Fi</div>', 'Wi-Fi'],
    ['cell', '<div role="cell">42</div>', '42'],
    ['treeitem', '<div role="treeitem">src</div>', 'src'],
    ['tooltip', '<div role="tooltip">Copied</div>', 'Copied'],
  ])('names role="%s" from its content', (_role, body, name) => {
    expect(nameOf(body)).toBe(name);
  });

  it('does not take a name from content for roles that do not allow it', () => {
    expect(nameOf('<div role="navigation">Links here</div>')).toBe('');
    expect(nameOf('<div role="textbox">typed text</div>')).toBe('');
    expect(nameOf('<div>Just text</div>')).toBe('');
  });

  it('follows the role attribute over the tag', () => {
    expect(nameOf('<h2 role="presentation">Decoration</h2>')).toBe('');
    expect(nameOf('<div role="heading">Section</div>')).toBe('Section');
  });

  it('still prefers aria-label over the content', () => {
    expect(nameOf('<div role="heading" aria-label="Plans">Pricing</div>')).toBe('Plans');
  });
});

describe('screen-reader view of a role="heading" element', () => {
  it('reads "heading level 2, Pricing"', () => {
    const lines = linearize(doc('<div role="heading" aria-level="2">Pricing</div>'));
    expect(lines.map((line) => line.text)).toEqual(['heading level 2, Pricing']);
    expect(lines[0].missing).toBe(false);
  });
});
