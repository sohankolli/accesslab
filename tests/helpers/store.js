// A fresh Redux store per test, with the app's reducers (no localStorage persistence).
import { configureStore } from '@reduxjs/toolkit';
import editorReducer from '../../src/features/editor/editorSlice';
import auditReducer from '../../src/features/audit/auditSlice';
import historyReducer from '../../src/features/report/historySlice';

export const makeStore = (preloadedState) =>
  configureStore({
    reducer: { editor: editorReducer, audit: auditReducer, history: historyReducer },
    preloadedState,
  });
