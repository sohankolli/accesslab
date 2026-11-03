// Checks the labeller on a page whose answers are known. Run: npm test (in ml/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { labelPage } from '../labelPage.mjs';
import { launchOptions } from '../browser.mjs';

const html = fs.readFileSync(new URL('./fixture.html', import.meta.url), 'utf8');

test('labels listeners, React props and key handlers; skips controls and hidden elements', async () => {
  const server = http.createServer((req, res) => res.end(html)).listen(0);
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(launchOptions());
  try {
    const { rows, page } = await labelPage(browser, url);
    const byId = Object.fromEntries(
      rows.map((r) => [/id="([^"]+)"/.exec(r.snippet)?.[1] ?? r.snippet, r]),
    );
    assert.equal(byId.listener.label, 1, 'addEventListener click');
    assert.equal(byId.react.label, 1, 'React onClick prop');
    assert.equal(byId.keyed.label, 1, 'keydown listener');
    assert.equal(byId.plain.label, 0, 'plain paragraph');
    for (const skipped of ['native', 'inside', 'link', 'hidden', 'role']) {
      assert.equal(byId[skipped], undefined, `${skipped} is not a candidate`);
    }
    assert.equal(rows[0].x.length, 552);
    assert.equal(page.delegated, false);
    assert.deepEqual(page.failedScripts, []);
  } finally {
    await browser.close();
    server.close();
  }
});
