// Pages in the corpus load a few libraries from public CDNs, which the crawler
// cannot reach in a sandbox. These are the same files, from npm, served in
// their place. A script that is neither here nor on the ignore list makes the
// page fail to load fully, and the crawler drops that page rather than label
// it with missing handlers.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** npm package → files inside it that are served. */
export const PACKAGES = {
  'jquery@3.7.1': ['dist/jquery.min.js'],
  'jquery@2.2.4': ['dist/jquery.min.js'],
  'jquery@1.12.4': ['dist/jquery.min.js'],
  'jquery-ui-dist@1.13.3': ['jquery-ui.min.js'],
  'bootstrap@5.3.3': ['dist/js/bootstrap.bundle.min.js', 'dist/js/bootstrap.min.js'],
  'bootstrap@4.6.2': ['dist/js/bootstrap.bundle.min.js', 'dist/js/bootstrap.min.js'],
  'bootstrap@3.4.1': ['dist/js/bootstrap.min.js'],
  'popper.js@1.16.1': ['dist/umd/popper.min.js'],
  '@popperjs/core@2.11.8': ['dist/umd/popper.min.js'],
};

/** Which local file answers a CDN script URL, or null. */
export function vendorFileFor(url) {
  const u = url.toLowerCase();
  const major = (re, fallback) => re.exec(u)?.[1] ?? fallback;
  if (/jquery-ui(\.min)?\.js/.test(u)) return 'jquery-ui-dist@1.13.3/jquery-ui.min.js';
  if (/jquery[-.\d]*(slim)?(\.min)?\.js|\/jquery\/[\d.]+\/jquery/.test(u)) {
    const m = major(/jquery[/@-](\d)\./, '3');
    const pkg = m === '1' ? 'jquery@1.12.4' : m === '2' ? 'jquery@2.2.4' : 'jquery@3.7.1';
    return `${pkg}/dist/jquery.min.js`;
  }
  if (/bootstrap(\.bundle)?(\.min)?\.js/.test(u)) {
    const m = major(/bootstrap[/@](\d)\./, '4');
    const pkg = m === '5' ? 'bootstrap@5.3.3' : m === '3' ? 'bootstrap@3.4.1' : 'bootstrap@4.6.2';
    const file = /bundle/.test(u) && m !== '3' ? 'bootstrap.bundle.min.js' : 'bootstrap.min.js';
    return `${pkg}/dist/js/${file}`;
  }
  if (/popper(\.min)?\.js/.test(u)) {
    return /@popperjs|popperjs\/core|\/2\.\d/.test(u)
      ? '@popperjs/core@2.11.8/dist/umd/popper.min.js'
      : 'popper.js@1.16.1/dist/umd/popper.min.js';
  }
  return null;
}

/** Third-party scripts that do not attach handlers to page elements: skipped silently. */
export const IGNORED_SCRIPT_HOSTS = [
  'buttons.github.io',
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'polyfill.io',
  'kit.fontawesome.com',
  'use.fontawesome.com',
  'code.iconify.design',
  'cdn.tailwindcss.com',
  'unpkg.com/ionicons',
];

export async function fetchVendor(vendorDir) {
  const dir = path.resolve(vendorDir);
  fs.mkdirSync(dir, { recursive: true });
  for (const spec of Object.keys(PACKAGES)) {
    const target = path.join(dir, spec);
    if (fs.existsSync(target)) continue;
    const tgz = execFileSync('npm', ['pack', spec, '--silent'], { cwd: dir }).toString().trim();
    fs.mkdirSync(target, { recursive: true });
    execFileSync('tar', ['-xzf', path.join(dir, tgz), '-C', target, '--strip-components=1']);
    fs.rmSync(path.join(dir, tgz));
    console.log(`vendor ${spec}`);
  }
}
