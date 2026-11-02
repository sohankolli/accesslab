import { createSlice } from '@reduxjs/toolkit';

const MAX_RUNS = 20;

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
      const { ranAt, score, issues = [] } = action.payload;

      const counts = {};

      // Items that need a human review are not scored.
      for (const { severity, needsReview } of issues) {
        if (!needsReview) {
          counts[severity] = (counts[severity] ?? 0) + 1;
        }
      }

      state.runs.unshift({
        id: String(ranAt),
        ranAt,
        score,
        counts,
        issues: issues.map(saveableIssue),
      });

      state.runs.splice(MAX_RUNS);
    },

    historyCleared(state) {
      state.runs = [];
    },

    historySaveResult(state, action) {
      state.saveFailed = !action.payload;
    },
  },
});

export const { runAdded, historyCleared, historySaveResult } = historySlice.actions;

export default historySlice.reducer;
