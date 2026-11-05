// Checks which crawled pages the training filter keeps. Run: npm test (in ml/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { keepPage, main } = require('../../filter_tranco_training_data.cjs');

test('keeps non-delegated pages and delegated React, Vue and Angular pages only', () => {
  for (const framework of ['react', 'vue', 'angular', 'jquery', 'other']) {
    assert.equal(keepPage({ delegated: false, framework }), true, framework);
  }
  assert.equal(keepPage({ delegated: true, framework: 'react' }), true);
  assert.equal(keepPage({ delegated: true, framework: 'vue' }), true);
  assert.equal(keepPage({ delegated: true, framework: 'angular' }), true);
  assert.equal(keepPage({ delegated: true, framework: 'jquery' }), false);
  assert.equal(keepPage({ delegated: true, framework: 'other' }), false);
});

test('the decision ignores the label: both labels on a page share its fate', () => {
  for (const delegated of [false, true]) {
    for (const framework of ['react', 'vue', 'angular', 'jquery', 'other']) {
      const page = { delegated, framework };
      assert.equal(keepPage({ ...page, label: 0 }), keepPage({ ...page, label: 1 }));
    }
  }
});

test('main writes the kept rows, drops landmarks and counts per page kind', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-'));
  const src = path.join(dir, 'src');
  const out = path.join(dir, 'out');
  fs.mkdirSync(src);
  const rows = [
    { site: 'a', page: 0, id: 1, delegated: false, framework: 'other', label: 1 },
    { site: 'a', page: 0, id: 2, delegated: false, framework: 'other', label: 0 },
    { site: 'b', page: 0, id: 1, delegated: true, framework: 'react', label: 1 },
    { site: 'b', page: 0, id: 2, delegated: true, framework: 'react', label: 0 },
    { site: 'b', page: 0, id: 3, delegated: true, framework: 'react', label: 0 },
    { site: 'c', page: 0, id: 1, delegated: true, framework: 'jquery', label: 1 },
    { site: 'c', page: 0, id: 2, delegated: true, framework: 'jquery', label: 0 },
  ];
  const snippets = rows.map((r) => ({
    site: r.site,
    page: r.page,
    id: r.id,
    snippet: r.site === 'b' && r.id === 3 ? '<nav class="x">' : '<div onclick="f()">',
  }));
  const jsonl = (xs) => xs.map((x) => JSON.stringify(x)).join('\n') + '\n';
  fs.writeFileSync(path.join(src, 'rows.jsonl'), jsonl(rows));
  fs.writeFileSync(path.join(src, 'snippets.jsonl'), jsonl(snippets));
  fs.writeFileSync(path.join(src, 'pages.jsonl'), '');

  const summary = await main({ sourceDir: src, targetDir: out });
  const kept = fs
    .readFileSync(path.join(out, 'rows.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  assert.deepEqual(
    kept.map((r) => `${r.site}${r.id}`),
    ['a1', 'a2', 'b1', 'b2'],
  );
  assert.equal(summary.rowsDroppedDelegatedOtherCode, 2);
  assert.equal(summary.landmarkRowsDropped, 1);
  assert.deepEqual(summary.kept, {
    'not delegated': { sites: 1, positives: 1, negatives: 1 },
    'delegated react': { sites: 1, positives: 1, negatives: 1 },
  });
  fs.rmSync(dir, { recursive: true, force: true });
});
