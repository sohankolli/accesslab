// features/report/historySlice.js
import { createSlice } from '@reduxjs/toolkit';

const MAX_RUNS = 20;

const historySlice = createSlice({
  name: 'history',
  // saveFailed: the browser refused to store the history (never saved itself).
  initialState: { runs: [], saveFailed: false },
  reducers: {
    runAdded(state, action) {
      const { ranAt, score, issues } = action.payload;
      const counts = {};
      // Items that need a human review are not scored, so they are not counted either.
      for (const { severity, needsReview } of issues) {
        if (!needsReview) counts[severity] = (counts[severity] ?? 0) + 1;
      }
      state.runs.unshift({ id: String(ranAt), ranAt, score, counts });
      state.runs.splice(MAX_RUNS); // keep the newest 20
    },
    historyCleared(state) {
      state.runs = [];
    },
    /** Set from app/store.js after each save attempt: payload is whether it worked. */
    historySaveResult(state, action) {
      state.saveFailed = !action.payload;
    },
  },
});

export const { runAdded, historyCleared, historySaveResult } = historySlice.actions;
export default historySlice.reducer;
