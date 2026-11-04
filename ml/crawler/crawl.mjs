// The crawler: labels every page in a site list and writes the dataset.
//
//   node crawler/crawl.mjs --sites data/sites.json --out data/crawl
//       [--corpus data/corpus] [--concurrency 2] [--limit N]
//
// Sites either list public `urls` (Tranco) or `paths` inside a local corpus
// (served from --corpus on 127.0.0.1). Public sites: robots.txt is obeyed, one
// page at a time per site, public pages only, no logins or form submissions.
//
// Output (all under --out, never committed):
//   rows.jsonl      one line per candidate element: numbers only, no page text
//   pages.jsonl     one line per page: framework, counts, failed scripts
//   snippets.jsonl  the element's HTML start, for hand-checking labels locally
// The run can be stopped and restarted: finished sites are skipped.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { labelPage } from './labelPage.mjs';
import { launchOptions } from './browser.mjs';
import { allowed, robotsFor } from './robots.mjs';
import { IGNORED_SCRIPT_HOSTS, vendorFileFor } from '../corpus/vendor.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const sitesFile = arg('sites', 'data/sites.json');
const outDir = arg('out', 'data/crawl');
const corpusRoot = arg('corpus') && path.resolve(arg('corpus'));
const concurrency = Number(arg('concurrency', 2));
const limit = Number(arg('limit', Infinity));
const keepFailed = process.argv.includes('--keep-failed-scripts');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

/** A static file server for the local corpus, bound to 127.0.0.1 only. */
function serve(root) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, rel);
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** Corpus pages may load scripts from CDNs: answer from local copies, never the network. */
function corpusRouting(vendorDir) {
  return async (context) => {
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
      const req = route.request();
      if (req.resourceType() !== 'script') return route.abort();
      const url = req.url();
      if (IGNORED_SCRIPT_HOSTS.some((h) => url.includes(h))) {
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
      }
      const local = vendorFileFor(url);
      if (local && fs.existsSync(path.join(vendorDir, local))) {
        return route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          path: path.join(vendorDir, local),
        });
      }
      return route.abort(); // counted as a failed script: the page is dropped
    });
  };
}

const sites = JSON.parse(fs.readFileSync(sitesFile, 'utf8')).slice(0, limit);
fs.mkdirSync(outDir, { recursive: true });
const pagesFile = path.join(outDir, 'pages.jsonl');
const done = new Set(
  fs.existsSync(pagesFile)
    ? fs
        .readFileSync(pagesFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l).site)
    : [],
);
const append = (name, lines) => {
  if (lines.length)
    fs.appendFileSync(
      path.join(outDir, name),
      lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
    );
};

const server = corpusRoot ? await serve(corpusRoot) : null;
const base = server && `http://127.0.0.1:${server.address().port}/`;
const prepareContext = corpusRoot ? corpusRouting(path.join(corpusRoot, '_vendor')) : undefined;
const browser = await chromium.launch(launchOptions());

let next = 0;
let finished = 0;
const todo = sites.filter((s) => !done.has(s.site));
console.log(`${todo.length} sites to crawl (${done.size} already done)`);

async function crawlSite(site) {
  const urls =
    site.urls ??
    site.paths.map((p) => new URL(p.split('/').map(encodeURIComponent).join('/'), base).href);
  const queue = [...urls];
  const rules = site.urls ? await robotsFor(new URL(urls[0]).origin) : [];
  for (let page = 0; page < 2 && queue.length; page++) {
    const url = queue.shift();
    const record = { site: site.site, group: site.group, category: site.category, page, url };
    if (!allowed(rules, new URL(url).pathname)) {
      append('pages.jsonl', [{ ...record, status: 'robots' }]);
      continue;
    }
    try {
      const { rows, page: facts } = await labelPage(browser, url, { prepareContext });
      const dropped = facts.failedScripts.length > 0 && !keepFailed;
      append('pages.jsonl', [
        { ...record, ...facts, links: undefined, status: dropped ? 'failed-scripts' : 'ok' },
      ]);
      if (!dropped) {
        const key = (r) => ({
          site: site.site,
          group: site.group,
          category: site.category,
          framework: facts.framework,
          delegated: facts.delegated,
          page,
          id: r.id,
        });
        append(
          'rows.jsonl',
          rows.map((r) => ({ ...key(r), label: r.label, x: r.x })),
        );
        append(
          'snippets.jsonl',
          rows.map((r) => ({ ...key(r), label: r.label, snippet: r.snippet })),
        );
      }
      if (site.discoverSecondPage && page === 0 && facts.links.length) {
        const internal = facts.links.find((l) => allowed(rules, new URL(l).pathname));
        if (internal) queue.push(internal);
      }
    } catch (err) {
      append('pages.jsonl', [
        { ...record, status: 'error', error: String(err.message).split('\n')[0].slice(0, 200) },
      ]);
    }
  }
}

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < todo.length) {
      const site = todo[next++];
      await crawlSite(site);
      if (++finished % 25 === 0) console.log(`${finished}/${todo.length} sites`);
    }
  }),
);
await browser.close();
server?.close();
console.log('done');
