// Measures the model where it runs: in the app's Web Worker, in a real browser.
//
//   npm run build && npm run ml:bench
//
// Opens the built app (vite preview), pastes a page with 2,000 candidate
// elements into the Workbench, switches model suggestions on, and reads the
// worker's own timing from the status line, 10 times. The median goes into the
// manifest's ship gate (public/models/clickables-v1.json), and the model is
// switched on by default only if every gate condition then passes.
// Needs Playwright (npm i -D playwright, or set CHROMIUM_PATH to a Chromium).
/* global document -- the waitForFunction callbacks run inside the browser page */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(root, 'public/models/clickables-v1.json');
const RUNS = 10;
const ELEMENTS = 2000;

const { chromium } = await import('playwright').catch(() => {
  console.error(
    'ml:bench needs Playwright: npm i -D playwright (or run it from ml/ after npm install there).',
  );
  process.exit(1);
});

if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
  console.error('Build the app first: npm run build');
  process.exit(1);
}

const port = 4319;
const base = `http://localhost:${port}`;

// 2,000 candidates: menus, cards and plain text, like a long real page.
const blocks = [];
for (let i = 0; blocks.length < ELEMENTS; i++) {
  blocks.push(`<li class="menu-item">Item ${i}</li>`, `<span class="tag">Tag ${i}</span>`);
  blocks.push(`<div class="card"><p>Text ${i}</p></div>`);
}
const html = `<!doctype html><html lang="en"><head><title>Bench</title></head><body><main><ul>${blocks
  .slice(0, ELEMENTS - 3)
  .join('')}</ul></main></body></html>`;

/** Serve dist/, paste the page, and read the worker's timing from the status line RUNS times. */
async function measure() {
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    if (
      await fetch(`${base}/audit`).then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const runs = [];
  let elements = null;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/audit`);
    await page.locator('#html-input').fill(html);
    const toggle = page.getByLabel('Suggestions from the model');
    await page.waitForFunction(
      () =>
        !document
          .querySelector('#model-switch-status')
          ?.textContent.includes('Loading the model details'),
    );
    if (!(await toggle.isChecked())) await toggle.check();
    const status = page.locator('#model-switch-status');
    let seen = 0;
    for (let run = 0; run < RUNS + 1; run++) {
      if (run > 0)
        await page
          .locator('#html-input')
          .press('End')
          .then(() => page.keyboard.type(' '));
      // Wait for a finished check of the 2,000-element page that is newer than the last one.
      await page.waitForFunction(
        ({ prev, min }) => {
          const el = document.querySelector('#model-switch-status');
          const t = el?.textContent ?? '';
          if (/unavailable/.test(t)) return true;
          const m = /Checked ([\d,]+) elements? in \d+ ms/.exec(t);
          return Number(el?.dataset.checks) > prev && m && Number(m[1].replace(/,/g, '')) >= min;
        },
        { prev: seen, min: ELEMENTS },
        { timeout: 60000 },
      );
      const text = await status.textContent();
      if (/unavailable/.test(text)) throw new Error(text);
      seen = Number(await status.getAttribute('data-checks'));
      const m = /Checked ([\d,]+) elements? in (\d+) ms/.exec(text);
      elements = Number(m[1].replace(/,/g, ''));
      if (run > 0) runs.push(Number(m[2])); // the first run includes loading the model
    }
  } finally {
    await browser.close();
    preview.kill();
    await new Promise((r) => setTimeout(r, 500));
  }
  runs.sort((a, b) => a - b);
  return { elements, runs, median: runs[Math.floor(runs.length / 2)] };
}

const cpus = os.cpus();
const conditions = `headless Chromium, ${cpus.length} × ${cpus[0]?.model?.trim() ?? 'CPU'}, no CPU throttling`;
const latency = (r) => ({
  target: '<= 50 ms for 2,000 elements in the Web Worker',
  value: r.median,
  pass: r.median <= 50 && r.elements >= ELEMENTS,
  elements: r.elements,
  runs: r.runs,
  note: `median of ${r.runs.length} runs in the app's Web Worker; ${conditions}`,
});

const shipped = await measure();
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.gate.latency = latency(shipped);
console.log(
  `shipped model: ${shipped.elements} elements, median ${shipped.median} ms (${shipped.runs.join(', ')})`,
);

// When a baseline ships as the fallback, time the graph network too, by
// swapping it into the built app for one more measurement.
const artifacts = path.join(root, 'ml/train/artifacts');
let graph = null;
if (
  manifest.shipped === 'fallback' &&
  fs.existsSync(path.join(artifacts, 'clickables-graph.onnx'))
) {
  const distModels = path.join(root, 'dist/models');
  const keep = ['clickables-v1.onnx', 'clickables-v1.json'].map((f) => [
    f,
    fs.readFileSync(path.join(distModels, f)),
  ]);
  try {
    fs.copyFileSync(
      path.join(artifacts, 'clickables-graph.onnx'),
      path.join(distModels, 'clickables-v1.onnx'),
    );
    const g = JSON.parse(fs.readFileSync(path.join(artifacts, 'clickables-graph.json'), 'utf8'));
    fs.writeFileSync(
      path.join(distModels, 'clickables-v1.json'),
      JSON.stringify({ ...g, model: 'clickables-v1.onnx' }),
    );
    graph = await measure();
    manifest.metrics.graphNetwork.gate.latency = latency(graph);
    console.log(`graph network: median ${graph.median} ms (${graph.runs.join(', ')})`);
  } finally {
    for (const [f, data] of keep) fs.writeFileSync(path.join(distModels, f), data);
  }
}

manifest.defaultOn = Object.values(manifest.gate).every((g) => g.pass === true);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
fs.mkdirSync(path.join(root, 'ml/reports'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'ml/reports/bench.json'),
  JSON.stringify({ conditions, elements: ELEMENTS, shipped, graph }, null, 1) + '\n',
);
console.log(`defaultOn: ${manifest.defaultOn}`);
