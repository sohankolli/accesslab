
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { focusOrder } from '../../src/engine/dom/focusOrder';

const doc = (html) => new JSDOM(html).window.document;

describe('focusOrder', () => {
  it('places positive tabindex values first in ascending order', () => {
    const document = doc(`
      <button id="first">First</button>
      <button id="third" tabindex="3">Third</button>
      <button id="second" tabindex="1">Second</button>
      <button id="normal" tabindex="0">Normal</button>
    `);

    expect(focusOrder(document).map((element) => element.id)).toEqual([
      'second',
      'third',
      'first',
      'normal',
    ]);
  });

  it('preserves DOM order for equal positive tabindex values', () => {
    const document = doc(`
      <button id="a" tabindex="2">A</button>
      <button id="b" tabindex="2">B</button>
      <button id="c" tabindex="1">C</button>
    `);

    expect(focusOrder(document).map((element) => element.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('excludes negative tabindex, disabled and hidden elements', () => {
    const document = doc(`
      <button id="visible">Visible</button>
      <button id="negative" tabindex="-1">Negative</button>
      <button id="disabled" disabled>Disabled</button>
      <input id="hidden" type="hidden">
      <div hidden><button id="inside-hidden">Hidden</button></div>
      <div aria-hidden="true"><button id="inside-aria-hidden">Hidden</button></div>
    `);

    expect(focusOrder(document).map((element) => element.id)).toEqual([
      'visible',
    ]);
  });

  it('excludes elements hidden with CSS', () => {
    const document = doc(`
      <button id="visible">Visible</button>
      <button id="display-none" style="display:none">Hidden</button>
      <button id="visibility-hidden" style="visibility:hidden">Hidden</button>
    `);

    expect(focusOrder(document).map((element) => element.id)).toEqual([
      'visible',
    ]);
  });
});
