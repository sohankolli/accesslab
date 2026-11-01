export const WEIGHT = { critical: 10, serious: 6, moderate: 3, minor: 1 };

/**
 * Each rule owns a share of the score proportional to its severity weight.
 * A rule with n issues loses (1 - 0.5^n) of its share: the first issue costs
 * half, later ones less, so one noisy rule cannot zero the whole score.
 */
export function computeScore(results) {
  let total = 0;
  let lost = 0;
  for (const { rule, issues } of results) {
    const w = WEIGHT[rule.severity];
    total += w;
    const counted = issues.filter((i) => !i.needsReview).length; // manual-review items are not penalised
    lost += w * (1 - 0.5 ** counted);
  }
  return total ? Math.round(100 * (1 - lost / total)) : 100;
}

/**
 * Run every rule against a rendered document.
 * @param {Document} doc
 * @param {import('./types.js').Rule[]} rules
 * @returns {import('./types.js').AuditResult}
 */
export function runAudit(doc, rules) {
  const ctx = { doc, win: doc.defaultView };
  const results = rules.map((rule) => {
    const t0 = performance.now();
    try {
      return { rule, issues: rule.check(ctx), ms: performance.now() - t0 };
    } catch (err) {
      return { rule, issues: [], error: err.message, ms: performance.now() - t0 };
    }
  });
  return toAuditResult(results);
}

/**
 * Turn per-rule results into the AuditResult that goes into Redux. Shared by
 * runAudit() and the sliced scheduler, so both produce exactly the same shape.
 * @param {{rule: import('./types.js').Rule, issues: import('./types.js').Issue[], ms: number, error?: string}[]} results
 * @returns {import('./types.js').AuditResult}
 */
export function toAuditResult(results) {
  return {
    ranAt: Date.now(),
    score: computeScore(results),
    issues: results.flatMap((r) => r.issues),
    timings: Object.fromEntries(results.map((r) => [r.rule.id, r.ms])),
    errors: results.filter((r) => r.error).map((r) => ({ ruleId: r.rule.id, error: r.error })),
  };
}
