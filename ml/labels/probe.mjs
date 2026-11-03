// An automated second opinion on the labels: click a random sample of labelled
// elements in the live page and watch whether anything happens.
//
//   node labels/probe.mjs --crawl data/crawl --corpus data/corpus [--n 300] [--seed 1]
//
// "Something happens" means the DOM changes, the address changes, or a dialog
// opens within 400 ms of a real mouse click. It is a proxy, not the truth: a
// handler may do nothing visible (analytics), and a DOM change may come from a
// handler on an ancestor. So it estimates label noise; the hand-check
// (labels/sheet.mjs) is still the owner's job. Results go to reports/label-probe.json.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchOptions } from '../crawler/browser.mjs';
import { FEATURE_SOURCE } from '../crawler/featureScript.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const crawlDir = arg('crawl', 'data/crawl');
const corpusRoot = path.resolve(arg('corpus', 'data/corpus'));
const n = Number(arg('n', 300));
let seed = Number(arg('seed', 1));
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const pages = new Map(
  fs
    .readFileSync(path.join(crawlDir, 'pages.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((p) => p.status === 'ok')
    .map((p) => [`${p.site}|${p.page}`, p]),
);
const rows = fs
  .readFileSync(path.join(crawlDir, 'snippets.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => pages.has(`${r.site}|${r.page}`));
const sample = [];
const pool = [...rows];
while (sample.length < n && pool.length)
  sample.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);

const server = http.createServer((req, res) => {
  const file = path.join(corpusRoot, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(corpusRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
    return res.writeHead(404).end();
  const type = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
  }[path.extname(file)];
  res.writeHead(200, type ? { 'content-type': type } : {});
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
/** Watch the page for 400 ms without touching it. */
const changesByItself = () =>
  new Promise((resolve) => {
    window.__alChanged = false;
    setTimeout(() => resolve(window.__alChanged), 400);
  });

/** Whether a click at the element's centre would land on a link, button or other control. */
const centreHitsControl = () => {
  const el = document.querySelector('[data-al-probe]');
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return Boolean(
    hit &&
    hit !== el &&
    el.contains(hit) &&
    hit.closest('a[href],button,input,select,textarea,label,summary'),
  );
};

const browser = await chromium.launch(launchOptions());
const results = [];

for (const row of sample) {
  const page = pages.get(`${row.site}|${row.page}`);
  const url = page.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, origin);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  const tab = await context.newPage();
  let outcome = 'not-run';
  try {
    await tab.goto(url, { waitUntil: 'load', timeout: 20000 });
    await tab.waitForTimeout(500);
    const ready = await tab.evaluate(
      ({ id, source }) => {
        const api = new Function(`return (${source})()`)();
        const el = document.body.querySelectorAll('*')[id];
        if (!el || !api.isStructuralCandidate(el)) return false;
        el.setAttribute('data-al-probe', '');
        window.__alChanged = false;
        new MutationObserver(() => (window.__alChanged = true)).observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        return true;
      },
      { id: row.id, source: FEATURE_SOURCE },
    );
    if (!ready) {
      outcome = 'element-not-found';
    } else if (await tab.evaluate(changesByItself)) {
      outcome = 'changes-by-itself'; // animations, timers: a change after a click would prove nothing
    } else if (await tab.evaluate(centreHitsControl)) {
      outcome = 'click-lands-on-a-control'; // the real mouse would click the link or button inside
    } else {
      let dialog = false;
      tab.on('dialog', (d) => {
        dialog = true;
        d.dismiss().catch(() => {});
      });
      const before = tab.url();
      await tab.evaluate(() => (window.__alChanged = false));
      await tab.locator('[data-al-probe]').click({ timeout: 2000, force: true, noWaitAfter: true });
      await tab.waitForTimeout(400);
      const changed =
        dialog ||
        tab.url() !== before ||
        (await tab.evaluate(() => window.__alChanged).catch(() => true));
      outcome = changed ? 'responds' : 'no-response';
    }
  } catch (err) {
    outcome = /intercepts|not visible|outside of the viewport|Timeout/i.test(err.message)
      ? 'not-clickable'
      : 'error';
  }
  await context.close();
  results.push({
    label: row.label,
    outcome,
    delegated: row.delegated,
    category: row.category,
    snippet: row.snippet.slice(0, 160),
  });
}
await browser.close();
server.close();

const tested = results.filter((r) => r.outcome === 'responds' || r.outcome === 'no-response');
const count = (label, outcome) =>
  tested.filter((r) => r.label === label && r.outcome === outcome).length;
const summary = {
  method:
    'Random sample of labelled candidates; each clicked once at its centre in the live page. "responds": the DOM, address or a dialog changed within 400 ms. Skipped as untestable: pages that change by themselves, and elements whose centre is a link or button. A response can still come from a handler on an ancestor, so disagreement is an upper bound on label noise.',
  sampled: results.length,
  tested: tested.length,
  untestable: Object.fromEntries(
    [
      'element-not-found',
      'changes-by-itself',
      'click-lands-on-a-control',
      'not-clickable',
      'error',
    ].map((o) => [o, results.filter((r) => r.outcome === o).length]),
  ),
  label1: { responds: count(1, 'responds'), noResponse: count(1, 'no-response') },
  label0: { responds: count(0, 'responds'), noResponse: count(0, 'no-response') },
};
const rate = (rows) =>
  rows.length
    ? rows.filter((r) => (r.label === 1) !== (r.outcome === 'responds')).length / rows.length
    : null;
summary.disagreementRate = rate(tested);
// Pages with document-level listeners are left out of training: report them apart.
summary.disagreementRateUsedPages = rate(tested.filter((r) => !r.delegated));
summary.testedUsedPages = tested.filter((r) => !r.delegated).length;
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync(
  'reports/label-probe.json',
  JSON.stringify(
    {
      summary,
      disagreements: tested.filter((r) => (r.label === 1) !== (r.outcome === 'responds')),
    },
    null,
    1,
  ),
);
console.log(JSON.stringify(summary, null, 1));
