import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { linearize } from '../../src/engine/dom/linearize';

const doc = (body) =>
  new JSDOM(`<!doctype html><html><head><title>T</title></head><body>${body}</body></html>`).window
    .document;
const read = (body) => linearize(doc(body)).map((line) => line.text);

describe('linearize (design doc Listing 15)', () => {
  it('reads the design doc example: a nav list with a text link and an icon-only link', () => {
    expect(
      read(`<nav><ul>
        <li><a href="/">Home</a></li>
        <li><a href="/cart"><svg aria-hidden="true"></svg></a></li>
      </ul></nav>`),
    ).toEqual([
      'navigation start',
      'list start',
      'link, Home',
      'link, (no name)',
      'list end',
      'navigation end',
    ]);
  });

  it('announces landmarks on entry and exit, nested in page order', () => {
    expect(
      read(`<header>Logo</header>
        <main><p>Body</p><form aria-label="Search"><p>In form</p></form></main>
        <footer>Small print</footer>`),
    ).toEqual([
      'banner start',
      'Logo',
      'banner end',
      'main start',
      'Body',
      'form start',
      'In form',
      'form end',
      'main end',
      'contentinfo start',
      'Small print',
      'contentinfo end',
    ]);
  });

  it('gives headings their level, from the tag or aria-level', () => {
    expect(read(`<h1>Menu</h1><h3>Drinks</h3><h2 aria-level="4">Hot</h2>`)).toEqual([
      'heading level 1, Menu',
      'heading level 3, Drinks',
      'heading level 4, Hot',
    ]);
  });

  it('reads links and buttons as "role, name"', () => {
    expect(
      read(`<a href="/menu">See the <b>menu</b></a><button>Order</button>
        <input type="submit" value="Send">`),
    ).toEqual(['link, See the menu', 'button, Order', 'button, Send']);
  });

  // A label is not a leaf, so its own text is read too, as Listing 15 does.
  it('reads form fields with their labels', () => {
    expect(
      read(`<label for="e">Email</label><input id="e" type="email">
        <label><input type="checkbox"> Subscribe</label>
        <label for="s">Size</label><select id="s"><option>Small</option></select>
        <textarea aria-label="Notes"></textarea>`),
    ).toEqual([
      'Email',
      'textbox, Email',
      'checkbox, Subscribe',
      'Subscribe',
      'Size',
      'combobox, Size',
      'textbox, Notes',
    ]);
  });

  it('reads paragraph text in page order, with whitespace collapsed', () => {
    expect(read(`<p>First   line\n  here.</p><h2>Then</h2><p>Second.</p>`)).toEqual([
      'First line here.',
      'heading level 2, Then',
      'Second.',
    ]);
  });

  it('skips aria-hidden and hidden content, scripts and styles', () => {
    expect(
      read(`<p>Seen</p>
        <div aria-hidden="true"><h2>Hidden heading</h2><button>Hidden button</button></div>
        <section hidden><p>Not shown</p></section>
        <script>var x = 1;</script><style>p{}</style>
        <p>Also seen</p>`),
    ).toEqual(['Seen', 'Also seen']);
  });

  it('skips decorative images (alt="") but reads informative ones, and marks a missing alt', () => {
    const lines = linearize(
      doc(`<img src="a.png" alt=""><img src="b.png" alt="A cat"><img src="c.png">`),
    );
    expect(lines.map((line) => line.text)).toEqual(['img, A cat', 'img, (no name)']);
    expect(lines.map((line) => line.missing)).toEqual([false, true]);
  });

  it('marks every unnamed control "(no name)" with missing: true', () => {
    const lines = linearize(doc(`<button></button><input type="text"><a href="/x"></a>`));
    expect(lines).toEqual([
      { role: 'button', text: 'button, (no name)', missing: true },
      { role: 'textbox', text: 'textbox, (no name)', missing: true },
      { role: 'link', text: 'link, (no name)', missing: true },
    ]);
  });

  it('uses roleOf, so an explicit role wins over the tag', () => {
    expect(read(`<div role="button">Fake</div><a href="/" role="button">Go</a>`)).toEqual([
      'button, Fake',
      'button, Go',
    ]);
  });

  it('accepts an element as the root as well as a document', () => {
    const d = doc(`<p>Outside</p><main><p>Inside</p></main>`);
    expect(linearize(d.querySelector('main')).map((line) => line.text)).toEqual([
      'main start',
      'Inside',
      'main end',
    ]);
  });
});
