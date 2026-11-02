// The same feature code gives the same numbers in Chromium (crawler) and in
// jsdom (the app's tests) for the same page, except where jsdom has no layout:
// element area and border radius. Run: npm test (in ml/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';
import { FEATURE_SOURCE } from '../featureScript.mjs';
import { launchOptions } from '../browser.mjs';

const html = fs
  .readFileSync(new URL('./fixture.html', import.meta.url), 'utf8')
  .replace(/<script>[\s\S]*?<\/script>/, '');
const NODE_DIM = 92;
const LAYOUT_ONLY = [16 + 9, 16 + 10]; // rounded corners, area (see DENSE in nodeFeatures.js)

test('Chromium and jsdom compute the same features, apart from layout', async () => {
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent(html);
    const fromChromium = await page.evaluate((source) => {
      const api = new Function(`return (${source})()`)();
      const { candidates, rows } = api.extractRows(document);
      return {
        ids: candidates.map((el) => el.id || el.localName),
        rows: rows.map((r) => Array.from(r)),
      };
    }, FEATURE_SOURCE);

    const dom = new JSDOM(html, { pretendToBeVisual: true });
    const api = new dom.window.Function(`return (${FEATURE_SOURCE})()`)();
    const fromJsdom = api.extractRows(dom.window.document);

    assert.deepEqual(
      fromJsdom.candidates.map((el) => el.id || el.localName),
      fromChromium.ids,
    );
    fromChromium.rows.forEach((row, i) => {
      row.forEach((v, k) => {
        if (LAYOUT_ONLY.includes(k % NODE_DIM)) return;
        assert.ok(
          Math.abs(v - fromJsdom.rows[i][k]) < 1e-6,
          `row ${i}, value ${k}: ${v} vs ${fromJsdom.rows[i][k]}`,
        );
      });
    });
  } finally {
    await browser.close();
  }
});
