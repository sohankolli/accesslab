// Clones every repository in sources.json at its pinned commit, keeping only
// the files a browser needs (HTML, CSS, JavaScript, SVG), and downloads the
// script libraries that pages load from CDNs (see vendor.mjs).
// Usage: node corpus/fetch.mjs [--root data/corpus]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fetchVendor } from './vendor.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const root = path.resolve(arg('root', 'data/corpus'));
const sources = JSON.parse(fs.readFileSync(new URL('./sources.json', import.meta.url), 'utf8'));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();

fs.mkdirSync(root, { recursive: true });
for (const { repo, commit } of sources.repos) {
  const dir = path.join(root, repo.replace('/', '_'));
  if (fs.existsSync(path.join(dir, '.git'))) {
    console.log(`have ${repo}`);
    continue;
  }
  fs.mkdirSync(dir, { recursive: true });
  try {
    git(dir, 'init', '-q');
    git(dir, 'remote', 'add', 'origin', `https://github.com/${repo}.git`);
    git(dir, 'config', 'core.sparseCheckout', 'true');
    git(
      dir,
      'sparse-checkout',
      'set',
      '--no-cone',
      '*.html',
      '*.htm',
      '*.js',
      '*.mjs',
      '*.css',
      '*.svg',
      '!node_modules/',
    );
    git(dir, 'fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', commit);
    git(dir, 'checkout', '-q', commit);
    console.log(`ok   ${repo}@${commit.slice(0, 7)}`);
  } catch (err) {
    console.error(`FAIL ${repo}: ${err.message.split('\n')[0]}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
await fetchVendor(path.join(root, '_vendor'));
