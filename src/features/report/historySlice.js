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

const historySlice = createSlice({
  name: 'history',
  initialState: { runs: [], saveFailed: false },

  reducers: {
    runAdded(state, action) {
      const { ranAt, score, issues = [], page } = action.payload;

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
