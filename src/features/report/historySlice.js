import { createSlice } from '@reduxjs/toolkit';
import { pageKeyOf, previousRunOfPage } from './pages';

// Each page keeps its own last 20 runs, so checking one page often never wipes
// out another page's history. The overall cap bounds what localStorage holds.
const MAX_RUNS_PER_PAGE = 20;
const MAX_RUNS = 100;

// Keep only the information needed to create a report.
// Do not store DOM elements, documents, or other browser objects.
function saveableIssue(issue) {
  return {
    id: issue.id,
    ruleId: issue.ruleId,
    severity: issue.severity,
    selector: issue.selector,
    snippet: issue.snippet,
    message: issue.message,
    impact: issue.impact,
    fix: {
      text: issue.fix?.text ?? '',
      ...(issue.fix?.css ? { css: issue.fix.css } : {}),
      ...(issue.fix?.color ? { color: issue.fix.color } : {}),
    },
    ...(issue.contrast ? { contrast: issue.contrast } : {}),
    ...(issue.needsReview ? { needsReview: true } : {}),
  };
}

/**
 * The page's latest saved run, when `audit` is just that run again: the same page,
 * the same code (by hash) and the same score. Then it is not saved a second time,
 * so refreshing the workbench or coming back to it does not grow the history.
 * Runs saved before hashes were recorded never match. The score must match too,
 * so switching a rule pack on or off still records the new score.
 * @param {object[]} runs newest first
 * @param {{score: number, codeHash?: string, page?: {key: string}}} audit
 */
export function repeatedRun(runs, audit) {
  if (!audit.codeHash) return undefined;
  const key = pageKeyOf(audit);
  const latest = runs.find((r) => pageKeyOf(r) === key);
  return latest?.codeHash === audit.codeHash && latest.score === audit.score ? latest : undefined;
}

const historySlice = createSlice({
  name: 'history',
  initialState: { runs: [], saveFailed: false },

  reducers: {
    runAdded(state, action) {
      const { ranAt, score, issues = [], page, codeHash } = action.payload;
      if (repeatedRun(state.runs, action.payload)) return; // nothing changed since that run

      const counts = {};

      // Items that need a human review are not scored.
      for (const { severity, needsReview } of issues) {
        if (!needsReview) {
          counts[severity] = (counts[severity] ?? 0) + 1;
        }
      }

      const run = {
        id: String(ranAt),
        ranAt,
        score,
        counts,
        issues: issues.map(saveableIssue),
        // Which page was checked: { key, name } (see pages.js).
        ...(page ? { page: { key: page.key, name: page.name } } : {}),
        // A fingerprint of the code that was checked (codeHash.js).
        ...(codeHash ? { codeHash } : {}),
      };
      state.runs.unshift(run);

      // Over the cap for this page: drop this page's oldest run.
      const key = pageKeyOf(run);
      const samePage = state.runs.filter((r) => pageKeyOf(r) === key);
      if (samePage.length > MAX_RUNS_PER_PAGE) {
        const oldest = samePage.at(-1);
        state.runs = state.runs.filter((r) => r !== oldest);
      }

      state.runs.splice(MAX_RUNS);
    },

    /** historyCleared() clears every page; historyCleared(pageKey) clears just that page. */
    historyCleared(state, action) {
      const key = action.payload;
      state.runs = key === undefined ? [] : state.runs.filter((r) => pageKeyOf(r) !== key);
    },

    historySaveResult(state, action) {
      state.saveFailed = !action.payload;
    },
  },
});

export const { runAdded, historyCleared, historySaveResult } = historySlice.actions;

export default historySlice.reducer;

/**
 * The score of the last run of the page now in the workbench, for "since the last
 * check". Only the same page counts: comparing two unrelated pages means nothing.
 * @param {{audit: {result: {ranAt: number, page?: {key: string}}|null}, history: {runs: object[]}}} state
 * @returns {number|null} null when this is the page's first check
 */
export const selectPreviousScore = (state) =>
  previousRunOfPage(state.history.runs, state.audit.result)?.score ?? null;
