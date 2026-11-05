import { createSlice, createSelector } from '@reduxjs/toolkit';
import { readPref } from '../../services/storage';
import { selectSortedIssues } from './auditSlice';

/** How every model suggestion is labelled while the model is experimental. */
export const LOW_CONFIDENCE = 'Low confidence: the model is experimental.';

/** Most "Not an issue" records kept in this browser; the oldest go first. */
export const MAX_DISMISSED = 200;

const saved = () => readPref('clickables') ?? {};

/**
 * Model suggestions: advisory findings from the click-only controls model.
 * They live apart from the audit result on purpose: they never change the
 * score, the history or the report.
 */
const clickablesSlice = createSlice({
  name: 'clickables',
  initialState: () => ({
    enabled: typeof saved().enabled === 'boolean' ? saved().enabled : null, // null: follow the model's default
    status: 'idle', // 'idle' | 'loading' | 'checking' | 'ready' | 'unavailable'
    message: null, // why suggestions are unavailable
    model: null, // {version, threshold, defaultOn} from the manifest; threshold: where suggestions start, or null
    findings: [],
    timing: null, // {elements, featuresMs, modelMs}
    checks: 0, // finished checks, so a new result can be told from an identical old one
    dismissed: Array.isArray(saved().dismissed) ? saved().dismissed.slice(-MAX_DISMISSED) : [],
  }),
  reducers: {
    modelSwitched(state, action) {
      state.enabled = action.payload;
      if (!action.payload) state.findings = [];
    },
    manifestLoaded(state, action) {
      state.model = action.payload;
      if (state.status === 'idle') state.status = 'ready';
    },
    modelUnavailable(state, action) {
      state.status = 'unavailable';
      state.message = action.payload;
      state.findings = [];
    },
    checkStarted(state) {
      if (state.status !== 'unavailable') state.status = 'checking';
    },
    checkLoading(state) {
      if (state.status !== 'unavailable') state.status = 'loading';
    },
    checkCompleted(state, action) {
      state.status = 'ready';
      state.findings = action.payload.findings;
      state.timing = action.payload.timing;
      state.checks += 1;
    },
    notAnIssue(state, action) {
      const finding = action.payload;
      state.dismissed = [
        ...state.dismissed.filter((d) => d.key !== finding.key),
        {
          key: finding.key,
          selector: finding.selector,
          p: finding.p,
          modelVersion: state.model?.version ?? null,
          at: new Date().toISOString(),
          x: finding.x,
        },
      ].slice(-MAX_DISMISSED);
    },
    dismissedCleared(state) {
      state.dismissed = [];
    },
  },
});

export const {
  modelSwitched,
  manifestLoaded,
  modelUnavailable,
  checkStarted,
  checkLoading,
  checkCompleted,
  notAnIssue,
  dismissedCleared,
} = clickablesSlice.actions;
export default clickablesSlice.reducer;

/** Whether suggestions are switched on: the user's choice, else the model's default. */
export const selectModelOn = (state) => {
  const c = state.clickables;
  if (!c || c.status === 'unavailable') return false;
  return c.enabled ?? Boolean(c.model?.defaultOn);
};

/** The suggestions to show: switched on, and not marked "Not an issue". */
export const selectAdvisory = createSelector(
  (state) => state.clickables?.findings,
  (state) => state.clickables?.dismissed,
  selectModelOn,
  (findings = [], dismissed = [], on) => {
    if (!on) return [];
    const hidden = new Set(dismissed.map((d) => d.key));
    return findings.filter((f) => !hidden.has(f.key));
  },
);

/**
 * Everything marked on the preview, in list order: the rule findings (sorted as
 * in the list), then the model's suggestions. A finding's number is its index
 * here plus one, so pins and list numbers agree.
 */
export const selectMarkedFindings = createSelector(
  selectSortedIssues,
  selectAdvisory,
  (issues, advisory) => (advisory.length ? [...issues, ...advisory] : issues),
);
