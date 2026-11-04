// Label audit: re-checks every row of the hand-check sheet against the live
// page, using hard evidence only, and writes the verdicts.
//
//   cd ml
//   node labels/audit.mjs [--sheet labels/review/handcheck.csv] [--out labels/review]
//                         [--snippets data/crawl/snippets.jsonl] [--base http://127.0.0.1:PORT/]
//
// Evidence per row (read from Chrome through the DevTools Protocol):
//   - the element's own click / mousedown / pointerdown / keydown listeners
//   - React handler props on the element (onClick, onMouseDown, onPointerDown, onKeyDown)
//   - the same on its ancestors, up to <body>
//   - listeners on document, <html>, <body> and window (event delegation)
//   - jQuery delegated handlers whose selector matches the element
// The pointer cursor is recorded but is never used as evidence.
//
// Verdicts, following the labelling rules in the specification:
//   correct  the element was found unchanged and the label matches the rule
//            ("candidate with its own listener or React handler = 1, else 0")
//   wrong    the element was found unchanged and the evidence contradicts the label
//   unsure   the page or the element could not be checked, or the page has changed
// A label 0 that is only clickable through delegation is correct under the rule;
// it is reported separately as known label noise, not counted as a labelling error.
//
// Never changes the original sheet. Writes handcheck.completed.csv,
// audit_notes.csv and label-audit-summary.md into --out.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchOptions } from '../crawler/browser.mjs';
import { FEATURE_SOURCE } from '../crawler/featureScript.mjs';
import { allowed, robotsFor } from '../crawler/robots.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const sheetPath = arg('sheet', 'labels/review/handcheck.csv');
const outDir = arg('out', 'labels/review');
const snippetsPath = arg('snippets', 'data/crawl/snippets.jsonl');
const base = arg('base', null); // for local corpus rows whose url is a relative path
const TYPES = ['click', 'mousedown', 'pointerdown', 'keydown'];
const REACT = ['onClick', 'onMouseDown', 'onPointerDown', 'onKeyDown'];

// ---------- CSV ----------
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') ((field += '"'), i++);
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') (row.push(field), (field = ''));
    else if (c === '\n') (row.push(field), rows.push(row), (row = []), (field = ''));
    else if (c !== '\r') field += c;
  }
  if (field || row.length) (row.push(field), rows.push(row));
  const [header, ...data] = rows;
  return data
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
const csvLine = (values) => values.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');

// ---------- matching the element again ----------
/** The start tag without the crawler's data-al-id, whitespace collapsed: what must match. */
const startTag = (html) =>
  (/^<[^>]*>/.exec(html.replace(/\s+/g, ' ').trim())?.[0] ?? '')
    .replace(/\sdata-al-id="\d+"/g, '')
    .replace(/\s+>/, '>');

const sheet = parseCsv(fs.readFileSync(sheetPath, 'utf8'));
const meta = new Map();
if (fs.existsSync(snippetsPath)) {
  // Delegation and framework as recorded at crawl time, for the report.
  const wanted = new Set(sheet.map((r) => `${r.site}|${r.element_index}`));
  for (const line of fs.readFileSync(snippetsPath, 'utf8').split('\n')) {
    if (!line) continue;
    const d = JSON.parse(line);
    const k = `${d.site}|${d.id}`;
    if (wanted.has(k) && !meta.has(`${k}|${startTag(d.snippet)}`)) {
      meta.set(`${k}|${startTag(d.snippet)}`, { framework: d.framework, delegated: d.delegated });
    }
  }
}

// ---------- evidence in the live page ----------
async function inspect(page, row) {
  const target = startTag(row.snippet);
  // Number <body> elements as the crawler did, then find the row's element:
  // first at its index, else the first element whose start tag matches.
  const found = await page.evaluate(
    ({ index, target, source, react }) => {
      const api = new Function(`return (${source})()`)();
      const all = [...document.body.querySelectorAll('*')];
      const tagOf = (el) =>
        (/^<[^>]*>/.exec(el.outerHTML.replace(/\s+/g, ' ').trim())?.[0] ?? '')
          .replace(/\sdata-al-id="\d+"/g, '')
          .replace(/\s+>/, '>');
      let el = all[index];
      let how = 'index';
      if (!el || tagOf(el) !== target) {
        const hits = all.filter((e) => tagOf(e) === target);
        el = hits.length === 1 ? hits[0] : null;
        how = hits.length === 1 ? 'snippet' : hits.length > 1 ? 'ambiguous' : 'missing';
      }
      if (!el) return { how };
      el.setAttribute('data-al-audit', '');
      const reactHandlers = (node) => {
        const key = Object.keys(node).find(
          (k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'),
        );
        return key ? react.filter((h) => typeof node[key]?.[h] === 'function') : [];
      };
      // Ancestors up to (not including) <body>, nearest first.
      const ancestors = [];
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement)
        ancestors.push(a);
      window.__alAudit = { el, ancestors };
      // jQuery delegated handlers: handlers bound on an ancestor or the document
      // with a selector that matches this element.
      const jq = [];
      const $ = window.jQuery;
      if ($ && $._data) {
        for (const host of [...ancestors, document.body, document.documentElement, document]) {
          const events = $._data(host, 'events') || {};
          for (const type of ['click', 'mousedown', 'pointerdown', 'keydown']) {
            for (const h of events[type] || []) {
              if (h.selector) {
                try {
                  if (el.matches(h.selector)) jq.push(`${type} "${h.selector}"`);
                } catch {
                  jq.push(`${type} "${h.selector}" (selector could not be tested)`);
                }
              }
            }
          }
        }
      }
      return {
        how,
        candidate: api.isStructuralCandidate(el),
        reactOwn: reactHandlers(el),
        reactAncestor: ancestors.findIndex((a) => reactHandlers(a).length > 0),
        jqDelegated: jq,
        cursor: getComputedStyle(el).cursor,
        tag: el.localName,
      };
    },
    { index: Number(row.element_index), target, source: FEATURE_SOURCE, react: REACT },
  );
  if (!found.how || !['index', 'snippet'].includes(found.how)) return found;

  const cdp = await page.context().newCDPSession(page);
  const listenersOf = async (expression) => {
    const { result } = await cdp.send('Runtime.evaluate', { expression });
    if (!result.objectId) return [];
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
      objectId: result.objectId,
      depth: 0,
    });
    return listeners.map((l) => l.type);
  };
  const own = await listenersOf('window.__alAudit.el');
  const ancestorCount = await page.evaluate(() => window.__alAudit.ancestors.length);
  let ancestorListener = -1;
  for (let i = 0; i < ancestorCount; i++) {
    const types = await listenersOf(`window.__alAudit.ancestors[${i}]`);
    if (types.some((t) => TYPES.includes(t))) {
      ancestorListener = i;
      break;
    }
  }
  const docLevel = [];
  for (const [name, expr] of [
    ['document', 'document'],
    ['html', 'document.documentElement'],
    ['body', 'document.body'],
    ['window', 'window'],
  ]) {
    const types = (await listenersOf(expr)).filter((t) => TYPES.includes(t));
    if (types.length) docLevel.push(`${name}:${[...new Set(types)].join('/')}`);
  }
  await cdp.detach();
  return {
    ...found,
    ownTypes: [...new Set(own)],
    ownHandler: own.some((t) => TYPES.includes(t)),
    ancestorListener,
    docLevel,
  };
}

function verdictFor(row, ev, loadProblem) {
  const label = Number(row.label);
  if (loadProblem) return ['unsure', loadProblem];
  if (ev.how === 'missing')
    return ['unsure', 'element not on the page any more (page changed since the crawl)'];
  if (ev.how === 'ambiguous')
    return ['unsure', 'page changed; several elements match the snippet, cannot tell which one'];
  if (!ev.candidate)
    return ['unsure', 'element is no longer a candidate (now a control or inside one)'];
  const own = ev.ownHandler || ev.reactOwn.length > 0;
  const evidence = [
    ev.ownHandler && `own listener (${ev.ownTypes.filter((t) => TYPES.includes(t)).join(', ')})`,
    ev.reactOwn.length && `React ${ev.reactOwn.join(', ')}`,
  ]
    .filter(Boolean)
    .join('; ');
  const delegatedBits = [
    ev.ancestorListener >= 0 &&
      `ancestor ${ev.ancestorListener + 1} level(s) up has a click-type listener`,
    ev.reactAncestor >= 0 && `React handler on ancestor ${ev.reactAncestor + 1} level(s) up`,
    ev.jqDelegated.length && `jQuery delegated ${ev.jqDelegated.join(', ')}`,
    ev.docLevel.length && `document-level listeners (${ev.docLevel.join(', ')})`,
  ].filter(Boolean);
  const via = ev.how === 'snippet' ? ' Element re-found by its snippet (index moved).' : '';
  if (label === 1) {
    return own
      ? ['correct', `label 1 confirmed: ${evidence}.${via}`]
      : [
          'wrong',
          `label 1 but no own click/mousedown/pointerdown/keydown listener and no React handler on the element.${delegatedBits.length ? ` Only: ${delegatedBits.join('; ')}.` : ''}${via}`,
        ];
  }
  if (own) return ['wrong', `label 0 but the element has ${evidence}.${via}`];
  return [
    'correct',
    `label 0 confirmed: no own listener or React handler.${
      delegatedBits.length
        ? ` May still be clickable through delegation: ${delegatedBits.join('; ')} (known label noise under the rule).`
        : ''
    }${via}`,
  ];
}

// ---------- run ----------
const browser = await chromium.launch(launchOptions());
const robotsCache = new Map();
const results = [];
for (const row of sheet) {
  const url = /^https?:/.test(row.url) ? row.url : base ? new URL(row.url, base).href : null;
  let ev = {};
  let loadProblem = null;
  if (!url) loadProblem = 'no absolute url and no --base given';
  else if (/^https?:/.test(row.url)) {
    const origin = new URL(url).origin;
    if (!robotsCache.has(origin)) robotsCache.set(origin, await robotsFor(origin));
    if (!allowed(robotsCache.get(origin), new URL(url).pathname))
      loadProblem = 'robots.txt disallows this page now';
  }
  if (!loadProblem) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    try {
      const res = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      if (res && res.status() >= 400) loadProblem = `page answered HTTP ${res.status()}`;
      else {
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
        ev = await inspect(page, row);
      }
    } catch (err) {
      loadProblem = `page could not be loaded: ${String(err.message).split('\n')[0].slice(0, 120)}`;
    }
    await context.close();
  }
  const [verdict, reason] = verdictFor(row, ev, loadProblem);
  const m = meta.get(`${row.site}|${row.element_index}|${startTag(row.snippet)}`) ?? {};
  results.push({ row, ev, verdict, reason, loadProblem, meta: m });
  console.log(`${row.n.padStart(3)} ${verdict.padEnd(7)} ${row.site}  ${reason.slice(0, 90)}`);
}
await browser.close();

// ---------- outputs ----------
fs.mkdirSync(outDir, { recursive: true });
const headerIn = Object.keys(sheet[0]);
const completedHeader = [...headerIn.filter((h) => h !== 'verdict'), 'verdict', 'reason'];
fs.writeFileSync(
  path.join(outDir, 'handcheck.completed.csv'),
  [
    completedHeader.join(','),
    ...results.map(({ row, verdict, reason }) =>
      csvLine([...headerIn.filter((h) => h !== 'verdict').map((h) => row[h]), verdict, reason]),
    ),
  ].join('\n') + '\n',
);
const notesHeader = [
  'n',
  'site',
  'url',
  'label',
  'verdict',
  'found_by',
  'candidate_now',
  'own_listener_types',
  'react_own_handlers',
  'ancestor_listener_levels_up',
  'react_ancestor_levels_up',
  'jquery_delegated',
  'document_level_listeners',
  'cursor_recorded_not_used',
  'crawl_framework',
  'crawl_delegated',
  'problem',
];
fs.writeFileSync(
  path.join(outDir, 'audit_notes.csv'),
  [
    notesHeader.join(','),
    ...results.map(({ row, ev, verdict, loadProblem, meta: m }) =>
      csvLine([
        row.n,
        row.site,
        row.url,
        row.label,
        verdict,
        ev.how ?? '',
        ev.candidate ?? '',
        (ev.ownTypes ?? []).join(' '),
        (ev.reactOwn ?? []).join(' '),
        ev.ancestorListener >= 0 ? ev.ancestorListener + 1 : '',
        ev.reactAncestor >= 0 ? ev.reactAncestor + 1 : '',
        (ev.jqDelegated ?? []).join(' | '),
        (ev.docLevel ?? []).join(' '),
        ev.cursor ?? '',
        m.framework ?? '',
        m.delegated ?? '',
        loadProblem ?? '',
      ]),
    ),
  ].join('\n') + '\n',
);

const verified = results.filter((r) => r.verdict !== 'unsure');
const wrong = verified.filter((r) => r.verdict === 'wrong');
const wilson = (k, n, z = 1.96) => {
  if (!n) return [null, null];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
};
const pct = (x) => (x == null ? 'n/a' : `${(100 * x).toFixed(1)}%`);
const byLabel = (l) => {
  const v = verified.filter((r) => Number(r.row.label) === l);
  return { n: v.length, wrong: v.filter((r) => r.verdict === 'wrong').length };
};
const l1 = byLabel(1);
const l0 = byLabel(0);
const delegatedOnly = verified.filter(
  (r) => r.verdict === 'correct' && Number(r.row.label) === 0 && /delegation/.test(r.reason),
);
const unsure = results.filter((r) => r.verdict === 'unsure');
const unsureReasons = unsure.reduce(
  (m, r) => ((m[r.reason.split(':')[0]] = (m[r.reason.split(':')[0]] ?? 0) + 1), m),
  {},
);
const inaccessible = [
  ...new Set(unsure.filter((r) => r.loadProblem).map((r) => `${r.row.site} (${r.loadProblem})`)),
];
const ci = wilson(wrong.length, verified.length);

const md = `# Label audit: hand-check of ${results.length} labels

Run: ${new Date().toISOString()} with \`ml/labels/audit.mjs\`, against the live pages, in Chromium.

## Method

Each row's page was loaded with scripts on, the element was found again (at its crawl index, or by its exact start tag if the page had moved), and Chrome's DevTools Protocol was asked for its event listeners. The verdict follows the specification's labelling rule: a candidate with its own click, mousedown, pointerdown or keydown listener, or a React onClick-style handler, is 1; any other candidate is 0. A pointer cursor or a button-like class name was recorded but never used as evidence.

- **correct**: the element was found unchanged and the evidence agrees with the label.
- **wrong**: the element was found unchanged and the evidence contradicts the label.
- **unsure**: the page or the element could not be checked, or the page has changed since the crawl. Not counted in the error rate.

## Result

| | Rows |
| --- | --- |
| Sampled | ${results.length} |
| Verified (correct + wrong) | ${verified.length} |
| Correct | ${verified.length - wrong.length} |
| Wrong | ${wrong.length} |
| Unsure | ${unsure.length} |

**Label error rate on verified rows: ${pct(verified.length ? wrong.length / verified.length : null)}** (${wrong.length} of ${verified.length}; 95% Wilson interval ${pct(ci[0])} to ${pct(ci[1])}).

| Label | Verified | Wrong | Error rate |
| --- | --- | --- | --- |
| 1 | ${l1.n} | ${l1.wrong} | ${pct(l1.n ? l1.wrong / l1.n : null)} |
| 0 | ${l0.n} | ${l0.wrong} | ${pct(l0.n ? l0.wrong / l0.n : null)} |

## Known label noise (not counted as errors)

${delegatedOnly.length} of the ${l0.n} verified label-0 rows have no handler of their own but may still be clickable through an ancestor, a jQuery delegated handler or a document-level listener. The rule labels them 0, so they are correct by the rule; they are the delegation noise the specification describes. They are listed in \`audit_notes.csv\`.

## Wrong labels

${wrong.length ? wrong.map((r) => `- Row ${r.row.n}, ${r.row.site}: ${r.reason}`).join('\n') : 'None.'}

## Rows that could not be verified

${
  Object.entries(unsureReasons)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n') || 'None.'
}

### Inaccessible pages

${inaccessible.length ? inaccessible.map((s) => `- ${s}`).join('\n') : 'None.'}

## Caveats

- Pages change. The audit checks the page as it is today, not as it was at crawl time; rows whose element no longer matches are unsure, never guessed.
- Listeners added only after a user interaction (for example on hover) are not seen, by the audit or by the crawler.
- The verdict checks the label against the rule. Whether the rule itself is a good definition of "click-only control" is a separate question: see the delegation section above.
`;
fs.writeFileSync(path.join(outDir, 'label-audit-summary.md'), md);
console.log(
  `\n${verified.length} verified, ${wrong.length} wrong, ${unsure.length} unsure. Files written to ${outDir}/`,
);
