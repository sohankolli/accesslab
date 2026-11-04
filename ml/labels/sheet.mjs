// Draws the random sample of labels for the owner's hand-check.
//
//   node labels/sheet.mjs [--crawl data/crawl] [--n 300] [--seed 359]
//
// Writes labels/review/handcheck.csv (not committed: it holds page snippets).
// Open each page (the url column, with the corpus served, or the live site),
// find the element from its snippet, try it with a mouse and a keyboard, and
// fill the verdict column with: correct, wrong or unsure. Then run
// labels/score.mjs to measure the label error rate.
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const crawlDir = arg('crawl', 'data/crawl');
const n = Number(arg('n', 300));
let seed = Number(arg('seed', 359));
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const pages = new Map(
  fs
    .readFileSync(path.join(crawlDir, 'pages.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((p) => p.status === 'ok')
    .map((p) => [`${p.site}|${p.page}`, p.url]),
);
const rows = fs
  .readFileSync(path.join(crawlDir, 'snippets.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => pages.has(`${r.site}|${r.page}`));
const sample = [];
while (sample.length < n && rows.length)
  sample.push(rows.splice(Math.floor(random() * rows.length), 1)[0]);

const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
const lines = [['n', 'site', 'url', 'element_index', 'label', 'snippet', 'verdict'].join(',')];
sample.forEach((r, i) => {
  const url = pages.get(`${r.site}|${r.page}`).replace(/^http:\/\/127\.0\.0\.1:\d+\//, '');
  lines.push([i + 1, r.site, url, r.id, r.label, r.snippet, ''].map(csv).join(','));
});
fs.mkdirSync('labels/review', { recursive: true });
fs.writeFileSync('labels/review/handcheck.csv', lines.join('\n') + '\n');
console.log(
  `labels/review/handcheck.csv: ${sample.length} labels (${sample.filter((r) => r.label).length} positive)`,
);
