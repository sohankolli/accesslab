// Two-pass labelling of one page.
//
// Pass 1, scripts on: the real page. Every element in <body> is numbered, and
// each structural candidate is labelled 1 when it has a click, mousedown,
// pointerdown or keydown listener (read from Chrome's own record through the
// DevTools Protocol) or a React onClick-style prop, and 0 otherwise.
//
// Pass 2, scripts off: the same DOM, reloaded at the same address with
// JavaScript disabled, exactly as AccessLab's sandboxed preview sees a pasted
// page. Features come from this copy, computed by the app's own feature code,
// and are joined to the labels by element number.
import { FEATURE_SOURCE } from './featureScript.mjs';

export const LISTENER_TYPES = ['click', 'mousedown', 'pointerdown', 'keydown'];
const REACT_HANDLERS = ['onClick', 'onMouseDown', 'onPointerDown', 'onKeyDown'];
const ID_ATTR = 'data-al-id';

/** Load a page and give its scripts a moment to attach their handlers. */
async function settle(page, url, timeout) {
  await page.goto(url, { waitUntil: 'load', timeout });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
}

/**
 * @param {import('playwright').Browser} browser
 * @param {string} url
 * @param {{timeout?: number, viewport?: {width: number, height: number},
 *   prepareContext?: (context: import('playwright').BrowserContext) => Promise<void>}} [options]
 *   prepareContext runs on both browser contexts, e.g. to answer CDN requests locally
 * @returns {Promise<{rows: object[], page: object}>}
 *   rows: one per candidate in the script-free copy: {id, label, x (552 numbers)}
 *   page: facts about the page (framework, failed scripts, delegated listeners, links)
 */
export async function labelPage(browser, url, { timeout = 30000, viewport, prepareContext } = {}) {
  viewport ??= { width: 1280, height: 800 };
  const failedScripts = [];
  const pageErrors = [];

  // ---- Pass 1: scripts on ----
  const liveContext = await browser.newContext({ viewport });
  await prepareContext?.(liveContext);
  try {
    const live = await liveContext.newPage();
    live.on('requestfailed', (req) => {
      if (req.resourceType() === 'script') failedScripts.push(req.url());
    });
    live.on('response', (res) => {
      if (res.request().resourceType() === 'script' && res.status() >= 400) {
        failedScripts.push(res.url());
      }
    });
    live.on('pageerror', (err) => pageErrors.push(String(err.message).slice(0, 200)));
    await settle(live, url, timeout);

    const facts = await live.evaluate(
      ({ source, idAttr, reactHandlers }) => {
        const api = new Function(`return (${source})()`)();
        const all = [...document.body.querySelectorAll('*')];
        const candidates = [];
        const react = {};
        all.forEach((el, i) => {
          el.setAttribute(idAttr, String(i));
          if (!api.isStructuralCandidate(el)) return;
          candidates.push(el);
          // React keeps an element's props on a private key: __reactProps$… (17+)
          // or __reactEventHandlers$… (16).
          const key = Object.keys(el).find(
            (k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'),
          );
          if (key && reactHandlers.some((h) => typeof el[key]?.[h] === 'function')) react[i] = 1;
        });
        window.__alCandidates = candidates;
        const anyKey = (prefix) =>
          all.some((el) => Object.keys(el).some((k) => k.startsWith(prefix)));
        const framework =
          anyKey('__reactFiber$') || anyKey('__reactInternalInstance$')
            ? 'react'
            : document.querySelector('[ng-version]')
              ? 'angular'
              : anyKey('__vue') || window.__VUE__
                ? 'vue'
                : window.jQuery
                  ? 'jquery'
                  : 'other';
        const here = new URL(location.href);
        const links = [...document.querySelectorAll('a[href]')]
          .map((a) => {
            try {
              return new URL(a.getAttribute('href'), location.href);
            } catch {
              return null;
            }
          })
          .filter((u) => u && u.origin === here.origin && u.pathname !== here.pathname)
          .filter((u) => !/\.(pdf|zip|png|jpe?g|gif|svg|mp4|mp3)$/i.test(u.pathname))
          .map((u) => u.origin + u.pathname);
        return {
          ids: candidates.map((el) => Number(el.getAttribute(idAttr))),
          react,
          framework,
          elementCount: all.length,
          links: [...new Set(links)].slice(0, 20),
          html: '<!doctype html>\n' + document.documentElement.outerHTML,
        };
      },
      { source: FEATURE_SOURCE, idAttr: ID_ATTR, reactHandlers: REACT_HANDLERS },
    );

    // Read every candidate's listeners from Chrome itself (DOMDebugger), so
    // addEventListener, on… properties and framework bindings all count.
    const cdp = await liveContext.newCDPSession(live);
    const { result: arr } = await cdp.send('Runtime.evaluate', {
      expression: 'window.__alCandidates',
    });
    const { result: props } = await cdp.send('Runtime.getProperties', {
      objectId: arr.objectId,
      ownProperties: true,
    });
    const objectIds = props
      .filter((p) => /^\d+$/.test(p.name))
      .sort((a, b) => Number(a.name) - Number(b.name))
      .map((p) => p.value.objectId);
    const labels = {};
    for (let k = 0; k < objectIds.length; k++) {
      const id = facts.ids[k];
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
        objectId: objectIds[k],
        depth: 0,
      });
      labels[id] =
        facts.react[id] || listeners.some((l) => LISTENER_TYPES.includes(l.type)) ? 1 : 0;
    }
    // Listeners on document, <html> or <body> may handle clicks for many
    // elements at once (delegation). Those elements get label 0 although they
    // are clickable: known label noise, recorded per page.
    let delegated = false;
    for (const expression of ['document', 'document.documentElement', 'document.body', 'window']) {
      const { result } = await cdp.send('Runtime.evaluate', { expression });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
        objectId: result.objectId,
      });
      if (listeners.some((l) => LISTENER_TYPES.includes(l.type))) delegated = true;
    }
    await liveContext.close();

    // ---- Pass 2: scripts off, same address so relative styles still load ----
    const stillContext = await browser.newContext({ viewport, javaScriptEnabled: false });
    await prepareContext?.(stillContext);
    try {
      const still = await stillContext.newPage();
      await still.route(url, (route) =>
        route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: facts.html }),
      );
      await still.goto(url, { waitUntil: 'load', timeout });
      const extracted = await still.evaluate(
        ({ source, idAttr }) => {
          const api = new Function(`return (${source})()`)();
          const { candidates, rows, truncated } = api.extractRows(document);
          return {
            truncated,
            rows: candidates.map((el, i) => ({
              id: Number(el.getAttribute(idAttr)),
              x: Array.from(rows[i], (v) => Math.round(v * 1e5) / 1e5),
              // For local review only (ml/labels): never written to the dataset.
              snippet: el.outerHTML.replace(/\s+/g, ' ').slice(0, 200),
            })),
          };
        },
        { source: FEATURE_SOURCE, idAttr: ID_ATTR },
      );
      const rows = extracted.rows
        .filter((r) => r.id in labels)
        .map((r) => ({ ...r, label: labels[r.id] }));
      return {
        rows,
        page: {
          framework: facts.framework,
          elementCount: facts.elementCount,
          candidates: facts.ids.length,
          visibleCandidates: rows.length,
          positives: rows.filter((r) => r.label === 1).length,
          delegated,
          truncated: extracted.truncated,
          failedScripts: [...new Set(failedScripts)],
          pageErrors: pageErrors.slice(0, 5),
          links: facts.links,
        },
      };
    } finally {
      await stillContext.close();
    }
  } finally {
    await liveContext.close().catch(() => {});
  }
}
