import { configureStore } from '@reduxjs/toolkit';
import editorReducer, {
  editorSaveResult,
  initialState as editorInitialState,
} from '../features/editor/editorSlice';
import auditReducer from '../features/audit/auditSlice';
import historyReducer, { historySaveResult } from '../features/report/historySlice';
import clickablesReducer from '../features/audit/clickablesSlice';
import { loadEditor, loadHistory, saveEditor, saveHistory } from '../services/storage';

/** How long typing must pause before the code is saved. */
const EDITOR_SAVE_DELAY = 300;

export const store = configureStore({
  reducer: {
    editor: editorReducer,
    audit: auditReducer,
    history: historyReducer,
    clickables: clickablesReducer,
  },
  // The code and the history saved before a refresh. No usable saved code: the sample.
  preloadedState: {
    editor: { ...editorInitialState, ...loadEditor() },
    history: { ...loadHistory(), saveFailed: false },
  },
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

// Persist the editor's code once typing pauses, not on every keystroke (each save
// writes the whole page to localStorage). If the browser refuses, the source pane says so.
const editorCode = ({ html, css, source, fileName }) => ({ html, css, source, fileName });
let lastCode = editorCode(store.getState().editor);
let saveTimer = null;

function saveCode() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const saved = saveEditor(lastCode);
  if (store.getState().editor.saveFailed === saved) store.dispatch(editorSaveResult(saved));
}

store.subscribe(() => {
  const code = editorCode(store.getState().editor);
  if (Object.keys(code).every((k) => code[k] === lastCode[k])) return;
  lastCode = code;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCode, EDITOR_SAVE_DELAY);
});

// A refresh within the delay would lose the last edit: save it as the page goes away.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (saveTimer !== null) saveCode();
  });
}
