// engine/scheduler.js
// The engine needs the live DOM, and Web Workers have no DOM, so rules must run on
// the main thread. To keep typing smooth on large pages, the audit runs in slices:
// after each slice of about 12 ms it yields to the browser, and a newer audit can
// cancel an older one through an AbortSignal.
const nextTask = () =>
  globalThis.scheduler?.yield
    ? globalThis.scheduler.yield() // Chromium: resumes ahead of other queued tasks
    : new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Run rules like runAudit(), but yield to the browser between rules whenever a
 * slice has used up its time budget. Rejects with an AbortError if `signal`
 * is aborted before a rule starts.
 * @param {Document} doc
 * @param {import('./types.js').Rule[]} rules
 * @param {{budgetMs?: number, signal?: AbortSignal, yieldFn?: () => Promise<void>}} [options]
 */
export async function runRulesSliced(
  doc,
  rules,
  { budgetMs = 12, signal, yieldFn = nextTask } = {},
) {
  const ctx = { doc, win: doc.defaultView };
  const results = [];
  let sliceStart = performance.now();
  for (const rule of rules) {
    if (signal?.aborted) throw new DOMException('Audit superseded', 'AbortError');
    const t0 = performance.now();
    try {
      results.push({ rule, issues: rule.check(ctx), ms: performance.now() - t0 });
    } catch (err) {
      results.push({ rule, issues: [], error: err.message, ms: performance.now() - t0 });
    }
    if (performance.now() - sliceStart > budgetMs) {
      await yieldFn();
      sliceStart = performance.now();
    }
  }
  return results; // then toAuditResult(results), exactly as runAudit() does
}
