// Builds the crawler's site list from a Tranco ranking (https://tranco-list.eu/),
// a CSV of "rank,domain" lines. Each site starts at https://<domain>/; the
// crawler adds one internal page it finds on the home page.
// Usage: node crawler/tranco.mjs tranco.csv [--limit 1000] [--out data/sites.json]
import fs from 'node:fs';
import path from 'node:path';

const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
if (!file) {
  console.error('Usage: node crawler/tranco.mjs tranco.csv [--limit 1000] [--out data/sites.json]');
  process.exit(1);
}
const limit = Number(arg('limit', 1000));
const out = arg('out', 'data/sites.json');
const sites = fs
  .readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.split(','))
  .filter(([rank, domain]) => /^\d+$/.test(rank) && domain)
  .slice(0, limit)
  .map(([rank, domain]) => ({
    site: domain.trim(),
    group: domain.trim(),
    category: 'tranco',
    rank: Number(rank),
    urls: [`https://${domain.trim()}/`],
    discoverSecondPage: true,
  }));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(sites, null, 1));
console.log(`${sites.length} sites written to ${out}`);
