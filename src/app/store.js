// app/store.js
import { configureStore } from '@reduxjs/toolkit';
import editorReducer from '../features/editor/editorSlice';
import auditReducer from '../features/audit/auditSlice';
import historyReducer, { historySaveResult } from '../features/report/historySlice';
import { loadHistory, saveHistory } from '../services/storage';

export const store = configureStore({
  reducer: { editor: editorReducer, audit: auditReducer, history: historyReducer },
  preloadedState: { history: { ...loadHistory(), saveFailed: false } },
});

// Persist only the history's runs, and only when they actually change. If the
// browser refuses (storage full or blocked), the Report page says so.
let lastRuns = store.getState().history.runs;
store.subscribe(() => {
  const { runs, saveFailed } = store.getState().history;
  if (runs === lastRuns) return;
  lastRuns = runs;
  const saved = saveHistory({ runs });
  if (saveFailed === saved) store.dispatch(historySaveResult(saved)); // the flag is wrong: fix it
});
