// Typing benchmark for the Workbench editor.
//
//   npm run bench:typing            builds, then runs both scenarios
//   node scripts/bench-typing.mjs --sections 600 --keys 80 --paused-keys 25
//
// It serves the production build with `vite preview`, opens /audit in headless
// Chrome with the CPU slowed down 4x, replaces the editor's HTML with a large
// generated page full of issues, and types into it:
//   1. continuous: a key every 100 ms, faster than the 400 ms pause that starts
//      an audit, so no audit runs until typing stops;
//   2. paused: after each key it waits until the audit of the new code has
//      finished and the page is idle again (results drawn), so every key lands
//      on a page that has just been re-checked.
// Continuous typing queues keys whenever one key costs more than the interval,
// so its numbers grow with the length of the run; the paused numbers are the
// cost of one key.
// "Time per key" is from the keydown event to the first frame after it, which
// is when the typed character is on screen.
//
// No dependencies: it talks to Chrome over the DevTools Protocol with Node's
// built-in WebSocket (Node 22+). Set CHROME_PATH if Chrome is not found.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: opts } = parseArgs({
  options: {
    sections: { type: 'string', default: '400' },
    keys: { type: 'string', default: '60' },
    'paused-keys': { type: 'string', default: '15' },
    interval: { type: 'string', default: '100' },
    throttle: { type: 'string', default: '4' },
    port: { type: 'string', default: '4179' },
    profile: { type: 'string' }, // write a CPU profile of the paused run to this file
  },
});
const SECTIONS = Number(opts.sections);
const KEYS = Number(opts.keys);
const PAUSED_KEYS = Number(opts['paused-keys']);
const INTERVAL = Number(opts.interval);
const THROTTLE = Number(opts.throttle);
const PORT = Number(opts.port);
const STORAGE_KEY = 'accesslab:v1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A large page with several issues in every section (about 330 bytes each). */
function largePage(sections) {
  const body = Array.from(
    { length: sections },
    (_, i) => `<section id="dup">
  <h3>Product ${i}</h3>
  <img src="p${i}.png">
  <p style="color:#aaa">Only ${i} left in stock, order soon.</p>
  <input type="text" placeholder="Quantity">
  <button></button>
  <a href="/p/${i}"></a>
</section>`,
  ).join('\n');
  return `<!doctype html>
<html lang="en">
<head><title>Large shop</title></head>
<body>
<main>
<h1>Shop</h1>
<p id="typing-here">Type here: </p>
${body}
</main>
</body>
</html>`;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('Chrome not found: set CHROME_PATH to its executable.');
  return found;
}

async function waitFor(check, timeoutMs, what) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await check().catch(() => undefined);
    if (value) return value;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await sleep(50);
  }
}

/** Start Chrome and return a small DevTools Protocol client for one page. */
async function openChrome() {
  const profileDir = mkdtempSync(join(tmpdir(), 'accesslab-bench-'));
  const debugPort = 9400 + Math.floor(Math.random() * 400);
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const version = await waitFor(
    async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json(),
    15000,
    'Chrome to start',
  );
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
    } else {
      for (const listener of listeners) listener(msg);
    }
  });
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => call(method, params, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');

  return {
    send,
    async evaluate(expression) {
      const { result, exceptionDetails } = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description);
      return result.value;
    },
    async goto(url) {
      const loaded = new Promise((resolve) => {
        const listener = (msg) => {
          if (msg.sessionId === sessionId && msg.method === 'Page.loadEventFired') {
            listeners.delete(listener);
            resolve();
          }
        };
        listeners.add(listener);
      });
      await send('Page.navigate', { url });
      await loaded;
    },
    async close() {
      const exited = new Promise((resolve) => chrome.once('exit', resolve));
      await call('Browser.close').catch(() => {});
      chrome.kill();
      await exited;
      try {
        rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // Chrome's helper processes can still be writing; a leftover temp folder is harmless.
      }
    },
  };
}

async function startPreview() {
  const vite = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(
    process.execPath,
    [vite, 'preview', '--port', String(PORT), '--strictPort'],
    {
      stdio: 'ignore',
    },
  );
  await waitFor(
    async () => (await fetch(`http://localhost:${PORT}/audit`)).ok,
    15000,
    'vite preview (did you run `npm run build`?)',
  );
  return server;
}

const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

function summary(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    keys: sorted.length,
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted.at(-1),
  };
}

/** The ranAt of the newest saved check, from the history the app keeps in localStorage. */
const LATEST_RUN = `(() => {
  try {
    return JSON.parse(localStorage.getItem('${STORAGE_KEY}'))?.history?.runs?.[0]?.ranAt ?? 0;
  } catch { return 0; }
})()`;

/** Wait until an audit newer than `after` (a Date.now() value in the page) is saved. */
const auditAfter = (page, after, timeoutMs = 120000) =>
  waitFor(async () => (await page.evaluate(LATEST_RUN)) > after, timeoutMs, 'an audit to finish');

async function typeKey(page) {
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type,
      key: 'a',
      code: 'KeyA',
      windowsVirtualKeyCode: 65,
      ...(type === 'keyDown' ? { text: 'a', unmodifiedText: 'a' } : {}),
    });
  }
}

async function main() {
  const server = await startPreview();
  const page = await openChrome();
  try {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.goto(`http://localhost:${PORT}/audit`);
    await waitFor(() => page.evaluate(LATEST_RUN), 30000, 'the first audit');

    // Replace the sample page with the large page in one edit, as a paste would.
    const html = largePage(SECTIONS);
    const before = await page.evaluate('Date.now()');
    // Chrome's Input.insertText takes minutes for 100+ KB, so set the value the
    // way React expects and fire the input event it listens to. The text is sent
    // in pieces to keep each DevTools message small.
    await page.evaluate('window.__benchHtml = []');
    for (let i = 0; i < html.length; i += 32768) {
      await page.evaluate(`window.__benchHtml.push(${JSON.stringify(html.slice(i, i + 32768))})`);
    }
    await page.evaluate(`(() => {
      const ta = document.getElementById('html-input');
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setValue.call(ta, window.__benchHtml.join(''));
      delete window.__benchHtml;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await auditAfter(page, before);
    const info = await page.evaluate(`(() => {
      const runs = JSON.parse(localStorage.getItem('${STORAGE_KEY}')).history.runs;
      const counts = runs[0].counts;
      return {
        bytes: new TextEncoder().encode(document.getElementById('html-input').value).length,
        issues: Object.values(counts).reduce((a, b) => a + b, 0),
        score: runs[0].score,
      };
    })()`);
    console.log(
      `Page: ${SECTIONS} sections, ${Math.round(info.bytes / 1024)} KB, ${info.issues} issues (score ${info.score}). CPU slowed ${THROTTLE}x.`,
    );

    // Put the caret in the text of the first paragraph, and record per key the
    // time from keydown to the first frame after it.
    await page.evaluate(`(() => {
      const ta = document.getElementById('html-input');
      const at = ta.value.indexOf('Type here: ') + 'Type here: '.length;
      ta.focus();
      ta.setSelectionRange(at, at);
      window.__keyTimes = [];
      addEventListener('keydown', (event) => {
        const start = event.timeStamp;
        requestAnimationFrame(() => setTimeout(() => window.__keyTimes.push(performance.now() - start), 0));
      }, true);
    })()`);
    await page.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    await sleep(500);

    // 1. Continuous typing.
    await page.evaluate('window.__keyTimes = []');
    for (let i = 0; i < KEYS; i++) {
      const started = Date.now();
      await typeKey(page);
      await sleep(Math.max(0, INTERVAL - (Date.now() - started)));
    }
    await sleep(500);
    const continuous = summary(await page.evaluate('window.__keyTimes'));
    // Let the audit that follows the burst finish before the next scenario.
    await auditAfter(page, (await page.evaluate('Date.now()')) - 400);
    await sleep(500);

    // 2. Typing with pauses long enough for an audit to finish between keys.
    if (opts.profile) {
      await page.send('Profiler.enable');
      await page.send('Profiler.setSamplingInterval', { interval: 200 });
      await page.send('Profiler.start');
    }
    await page.evaluate('window.__keyTimes = []');
    for (let i = 0; i < PAUSED_KEYS; i++) {
      const sent = await page.evaluate('Date.now()');
      await typeKey(page);
      await auditAfter(page, sent);
      // Let the new results render and settle before the next key.
      await page.evaluate(
        'new Promise((r) => requestIdleCallback(() => requestIdleCallback(r), { timeout: 20000 }))',
      );
    }
    const paused = summary(await page.evaluate('window.__keyTimes'));
    if (opts.profile) {
      const { profile } = await page.send('Profiler.stop');
      const { writeFileSync } = await import('node:fs');
      writeFileSync(opts.profile, JSON.stringify(profile));
      console.log(`CPU profile of the paused run: ${opts.profile}`);
    }

    const row = (name, s) =>
      `${name.padEnd(22)} ${String(s.keys).padStart(4)}  ${s.median.toFixed(1).padStart(8)}  ${s.p95.toFixed(1).padStart(8)}  ${s.max.toFixed(1).padStart(8)}`;
    console.log(`\n${'Scenario'.padEnd(22)} keys  median ms    p95 ms    max ms`);
    console.log(row(`continuous (${INTERVAL} ms)`, continuous));
    console.log(row('paused (audit between)', paused));
  } finally {
    await page.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
