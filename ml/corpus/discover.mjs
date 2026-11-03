// Turns the fetched corpus into the crawler's site list.
// 'projects' repositories: every folder with an HTML page is one site, at most
// maxSitesPerRepo per repository (a seeded random sample). 'template'
// repositories: one site, its home page plus one internal page found by the
// crawler, as for a Tranco site.
// Usage: node corpus/discover.mjs [--root data/corpus] [--out data/sites.json]
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const root = path.resolve(arg('root', 'data/corpus'));
const out = arg('out', 'data/sites.json');
const sources = JSON.parse(fs.readFileSync(new URL('./sources.json', import.meta.url), 'utf8'));
const SKIP_DIRS =
  /^(\.git|node_modules|bower_components|vendors?|plugins|libs?|tests?|spec|__tests__|cypress|coverage|_vendor)$/i;

/** Small seeded generator (mulberry32), so the sample is the same on every run. */
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function htmlDirs(dir, found = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const pages = entries
    .filter((e) => e.isFile() && /\.html?$/i.test(e.name))
    .map((e) => e.name)
    .sort();
  if (pages.length) found.push({ dir, pages });
  for (const e of entries) {
    if (e.isDirectory() && !SKIP_DIRS.test(e.name)) htmlDirs(path.join(dir, e.name), found);
  }
  return found;
}

const random = rng(sources.seed);
const sites = [];
for (const src of sources.repos) {
  const repoDir = path.join(root, src.repo.replace('/', '_'));
  if (!fs.existsSync(repoDir)) {
    console.warn(`missing ${src.repo}: run corpus/fetch.mjs`);
    continue;
  }
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  if (src.mode === 'template') {
    sites.push({
      site: src.repo,
      group: src.repo,
      category: src.category,
      paths: [rel(path.join(repoDir, src.home))],
      discoverSecondPage: true,
    });
    continue;
  }
  let found = htmlDirs(repoDir).filter((f) => f.dir !== repoDir || f.pages.length === 1);
  // Shuffle (Fisher–Yates) and keep the first maxSitesPerRepo.
  for (let i = found.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [found[i], found[j]] = [found[j], found[i]];
  }
  found = found.slice(0, sources.maxSitesPerRepo);
  for (const { dir, pages } of found) {
    const home =
      pages.find((p) => /^index\.html?$/i.test(p)) ??
      pages.find((p) => /finished/i.test(p)) ??
      pages[0];
    const second = pages.find((p) => p !== home && !/start/i.test(p));
    sites.push({
      site: rel(dir),
      group: src.repo,
      category: src.category,
      paths: [rel(path.join(dir, home)), ...(second ? [rel(path.join(dir, second))] : [])],
    });
  }
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(sites, null, 1));
const byCat = sites.reduce((m, s) => ((m[s.category] = (m[s.category] ?? 0) + 1), m), {});
console.log(`${sites.length} sites, ${sites.reduce((n, s) => n + s.paths.length, 0)} pages`, byCat);
