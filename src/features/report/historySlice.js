// features/report/historySlice.js
import { createSlice } from '@reduxjs/toolkit';

const MAX_RUNS = 20;

const historySlice = createSlice({
  name: 'history',
  initialState: { runs: [] },
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
    historyCleared: () => ({ runs: [] }),
  },
});

export const { runAdded, historyCleared } = historySlice.actions;
export default historySlice.reducer;
