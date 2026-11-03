import { createSlice, createSelector } from '@reduxjs/toolkit';

const initialState = {
  status: 'idle', // 'idle' | 'running' | 'done' | 'failed'
  result: null, // AuditResult: plain, serialisable data only
  checked: null, // { html, css }: the code `result` belongs to (the same strings as the editor's)
  error: null, // why the last audit failed (a message), while status is 'failed'
  previousScore: null, // for the before/after delta
  selectedIssueId: null,
  simulation: 'none', // 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'low-vision' | 'zoom-200'
};

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    auditStarted(state) {
      state.status = 'running';
      state.error = null;
    },
    /** auditCompleted(result, {html, css}): the result and the code that was checked. */
    auditCompleted: {
      reducer(state, action) {
        state.previousScore = state.result?.score ?? null;
        state.result = action.payload;
        state.checked = action.meta ?? null;
        state.status = 'done';
        state.error = null;
      },
      prepare: (result, checked = null) => ({ payload: result, meta: checked }),
    },
    /** The audit threw: stop "checking", keep the last good result, say why. */
    auditFailed(state, action) {
      state.status = 'failed';
      state.error = action.payload;
    },
    issueSelected(state, action) {
      state.selectedIssueId = action.payload;
    },
    simulationChanged(state, action) {
      state.simulation = action.payload;
    },
  },
});

export const { auditStarted, auditCompleted, auditFailed, issueSelected, simulationChanged } =
  auditSlice.actions;
export default auditSlice.reducer;

/**
 * Whether the last audit result is for exactly the code now in the editor.
 * Simulate uses it to explain missing marks; it never runs an audit itself.
 * @param {{audit: {result: unknown, checked: {html: string, css: string}|null}, editor: {html: string, css: string}}} state
 */
export const selectResultIsCurrent = (state) =>
  Boolean(state.audit.result) &&
  state.audit.checked?.html === state.editor.html &&
  state.audit.checked?.css === state.editor.css;

const ORDER = ['critical', 'serious', 'moderate', 'minor'];

/** Where an issue goes in the list: by severity, with "check by hand" items last. */
const rank = (issue) => (issue.needsReview ? ORDER.length : ORDER.indexOf(issue.severity));

/**
 * Memoised: re-sorts only when the issues array itself changes. An issue's
 * number in the list (and on its preview pin) is its index here plus one.
 */
export const selectSortedIssues = createSelector(
  (state) => state.audit.result?.issues,
  (issues = []) => [...issues].sort((a, b) => rank(a) - rank(b)),
);
