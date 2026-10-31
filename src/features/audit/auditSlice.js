// features/audit/auditSlice.js
import { createSlice, createSelector } from '@reduxjs/toolkit';

const initialState = {
  status: 'idle', // 'idle' | 'running' | 'done' | 'failed'
  result: null, // AuditResult: plain, serialisable data only
  error: null, // why the last audit failed (a message), while status is 'failed'
  previousScore: null, // for the before/after delta
  selectedIssueId: null,
  simulation: 'none', // 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'low-vision' | 'zoom-200'
  overlay: 'issues', // 'issues' | 'tab-order' | 'none'
};

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    auditStarted(state) {
      state.status = 'running';
      state.error = null;
    },
    auditCompleted(state, action) {
      state.previousScore = state.result?.score ?? null;
      state.result = action.payload;
      state.status = 'done';
      state.error = null;
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
    overlayChanged(state, action) {
      state.overlay = action.payload;
    },
  },
});

export const {
  auditStarted,
  auditCompleted,
  auditFailed,
  issueSelected, simulationChanged, overlayChanged } =
  auditSlice.actions;
export default auditSlice.reducer;

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
