// app/store.js
import { configureStore } from '@reduxjs/toolkit';
import editorReducer from '../features/editor/editorSlice';
import auditReducer from '../features/audit/auditSlice';
import historyReducer from '../features/report/historySlice';
import { loadHistory, saveHistory } from '../services/storage';

export const store = configureStore({
  reducer: { editor: editorReducer, audit: auditReducer, history: historyReducer },
  preloadedState: { history: loadHistory() },
});

// Persist only the small history slice, and only when it actually changes.
let lastHistory = store.getState().history;
store.subscribe(() => {
  const { history } = store.getState();
  if (history !== lastHistory) {
    lastHistory = history;
    saveHistory(history);
  }
});
