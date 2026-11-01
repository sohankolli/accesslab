import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { linearize } from '../../src/engine/dom/linearize';

const doc = (html) => new JSDOM(html).window.document;

describe('linearize', () => {
  it('includes headings and named focusable controls', () => {
    const document = doc(`
      <h1>Welcome</h1>
      <label for="email">Email address</label>
      <input id="email" type="email">
      <button>Continue</button>
    `);

    const result = linearize(document);

    expect(result.map((item) => item.name)).toEqual([
      'Welcome',
      'Email address',
      'Continue',
    ]);

    expect(result[0].role).toBe('h1 heading');
    expect(result[1].role).toBe('textbox');
    expect(result[2].role).toBe('button');
  });

  it('omits decorative images and includes informative images', () => {
    const document = doc(`
      <img src="decoration.png" alt="">
      <img src="cat.png" alt="A cat sitting on a chair">
      <img src="missing.png">
    `);

    const result = linearize(document);

    expect(result.map((item) => item.name)).toEqual([
      'A cat sitting on a chair',
      'Image without alt text',
    ]);

  });

  it('respects aria-hidden and hidden elements', () => {
    const document = doc(`
      <h1>Visible heading</h1>
      <div aria-hidden="true">
        <h2>Hidden heading</h2>
        <button>Hidden button</button>
        <img src="hidden.png" alt="Hidden image">
      </div>
      <button hidden>Hidden control</button>
    `);

    const result = linearize(document);

    expect(result.map((item) => item.name)).toEqual([
      'Visible heading',
    ]);
  });
});