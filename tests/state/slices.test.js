import { describe, it, expect } from 'vitest';
import historyReducer, { runAdded, historyCleared } from '../../src/features/report/historySlice';
import auditReducer, {
  auditStarted,
  auditCompleted,
  auditFailed,
  selectSortedIssues,
} from '../../src/features/audit/auditSlice';
import editorReducer, {
  htmlChanged,
  cssChanged,
  fixApplied,
  sampleLoaded,
  MAX_PAGE_BYTES,
} from '../../src/features/editor/editorSlice';

const audit = (ranAt, score, severities = []) => ({
  ranAt,
  score,
  issues: severities.map((severity, i) => ({ id: `r:${i}`, severity })),
  timings: {},
  errors: [],
});

describe('historySlice', () => {
  it('stores newest first with issue counts and findings per severity', () => {
    const state = historyReducer(
      undefined,
      runAdded(audit(1000, 67, ['critical', 'critical', 'moderate'])),
    );

    expect(state.runs).toHaveLength(1);
    expect(state.runs[0]).toMatchObject({
      id: '1000',
      ranAt: 1000,
      score: 67,
      counts: { critical: 2, moderate: 1 },
      issues: [
        { id: 'r:0', severity: 'critical' },
        { id: 'r:1', severity: 'critical' },
        { id: 'r:2', severity: 'moderate' },
      ],
    });
  });

  it('keeps only the newest 20 runs', () => {
    let state = historyReducer(undefined, { type: 'init' });
    for (let i = 1; i <= 25; i++) state = historyReducer(state, runAdded(audit(i, i)));
    expect(state.runs).toHaveLength(20);
    expect(state.runs[0].ranAt).toBe(25);
    expect(state.runs.at(-1).ranAt).toBe(6);
  });

  it('does not count items that need manual review (they are not scored)', () => {
    const run = audit(1, 90, ['serious', 'minor']);
    run.issues[1].needsReview = true;
    expect(historyReducer(undefined, runAdded(run)).runs[0].counts).toEqual({ serious: 1 });
  });

  it('can be cleared', () => {
    const state = historyReducer(undefined, runAdded(audit(1, 50)));
    expect(historyReducer(state, historyCleared())).toEqual({ runs: [], saveFailed: false });
  });

  const onPage = (ranAt, score, name) => ({
    ...audit(ranAt, score),
    page: { key: `page:${name.toLowerCase()}`, name },
  });

  it('saves the page with each run', () => {
    const state = historyReducer(undefined, runAdded(onPage(1, 50, 'Menu')));
    expect(state.runs[0].page).toEqual({ key: 'page:menu', name: 'Menu' });
    expect(historyReducer(state, runAdded(audit(2, 60))).runs[0]).not.toHaveProperty('page');
  });

  it('keeps 20 runs per page, so one busy page never pushes out another', () => {
    let state = historyReducer(undefined, runAdded(onPage(1, 50, 'Other')));
    for (let i = 2; i <= 30; i++) state = historyReducer(state, runAdded(onPage(i, i, 'Busy')));
    const busy = state.runs.filter((r) => r.page.key === 'page:busy');
    expect(busy).toHaveLength(20);
    expect(busy.at(-1).ranAt).toBe(11); // the oldest ones went
    expect(state.runs.at(-1).page.name).toBe('Other');
  });

  it('clears one page, leaving the others and the earlier checks', () => {
    let state = historyReducer(undefined, runAdded(audit(1, 40))); // an earlier check
    state = historyReducer(state, runAdded(onPage(2, 50, 'A')));
    state = historyReducer(state, runAdded(onPage(3, 60, 'B')));
    state = historyReducer(state, runAdded(onPage(4, 70, 'A')));
    state = historyReducer(state, historyCleared('page:a'));
    expect(state.runs.map((r) => r.ranAt)).toEqual([3, 1]);
    state = historyReducer(state, historyCleared('earlier'));
    expect(state.runs.map((r) => r.ranAt)).toEqual([3]);
  });
});

describe('auditSlice', () => {
  it('has no previousScore after the first audit', () => {
    let state = auditReducer(undefined, auditStarted());
    expect(state.status).toBe('running');
    state = auditReducer(state, auditCompleted(audit(1, 67)));
    expect(state).toMatchObject({ status: 'done', previousScore: null });
    expect(state.result.score).toBe(67);
  });

  it('remembers the previous score for the before/after delta', () => {
    let state = auditReducer(undefined, auditCompleted(audit(1, 67)));
    state = auditReducer(state, auditCompleted(audit(2, 86)));
    expect(state.previousScore).toBe(67);
    state = auditReducer(state, auditCompleted(audit(3, 100)));
    expect(state.previousScore).toBe(86);
  });

  it('stops running and keeps the last result when an audit fails', () => {
    let state = auditReducer(undefined, auditCompleted(audit(1, 67)));
    state = auditReducer(state, auditStarted());
    state = auditReducer(state, auditFailed('Out of memory'));
    expect(state).toMatchObject({ status: 'failed', error: 'Out of memory' });
    expect(state.result.score).toBe(67);
    // The next audit clears the error.
    state = auditReducer(state, auditStarted());
    expect(state).toMatchObject({ status: 'running', error: null });
  });

  it('selectSortedIssues orders by severity and is memoised', () => {
    const result = audit(1, 50, ['minor', 'critical', 'moderate', 'serious', 'critical']);
    const root = { audit: auditReducer(undefined, auditCompleted(result)) };
    const sorted = selectSortedIssues(root);
    expect(sorted.map((i) => i.severity)).toEqual([
      'critical',
      'critical',
      'serious',
      'moderate',
      'minor',
    ]);
    expect(selectSortedIssues(root)).toBe(sorted); // same input, same array
    expect(result.issues[0].severity).toBe('minor'); // the stored array is not mutated
  });
});

describe('editorSlice', () => {
  it('starts with the sample page and updates html and css', () => {
    let state = editorReducer(undefined, { type: 'init' });
    expect(state.html).toContain('<html lang="en">');
    expect(state).toMatchObject({ source: 'sample', fileName: null });
    state = editorReducer(state, htmlChanged('<p>Hi</p>'));
    state = editorReducer(state, cssChanged('p { color: red }'));
    expect(state).toMatchObject({ html: '<p>Hi</p>', css: 'p { color: red }', source: 'paste' });
  });

  it('keeps a file or link source while the user edits it', () => {
    const opened = {
      ...editorReducer(undefined, { type: 'init' }),
      source: 'file',
      fileName: 'a.html',
    };
    const state = editorReducer(opened, htmlChanged('<p>edited</p>'));
    expect(state).toMatchObject({ source: 'file', fileName: 'a.html' });
  });

  it('a refused edit does not change the source', () => {
    const start = editorReducer(undefined, { type: 'init' });
    const state = editorReducer(start, htmlChanged('a'.repeat(MAX_PAGE_BYTES + 1)));
    expect(state.source).toBe('sample');
  });

  it('sampleLoaded puts back the sample and clears the file name', () => {
    const opened = {
      ...editorReducer(undefined, cssChanged('x')),
      source: 'file',
      fileName: 'a.css',
    };
    const state = editorReducer(opened, sampleLoaded());
    expect(state).toMatchObject({ source: 'sample', fileName: null });
    expect(state.css).not.toBe('x');
  });
});

describe('fixApplied', () => {
  const fix = { ruleId: 'color-contrast', css: 'p { color: #757575 !important; }' };
  const line = 'p { color: #757575 !important; } /* AccessLab fix: color-contrast */';

  it('appends the fix as one commented line', () => {
    let state = editorReducer(undefined, cssChanged('body { margin: 0 }\n\n'));
    state = editorReducer(state, fixApplied(fix));
    expect(state.css).toBe(`body { margin: 0 }\n${line}\n`);
  });
  it('works on an empty stylesheet', () => {
    const state = editorReducer(editorReducer(undefined, cssChanged('')), fixApplied(fix));
    expect(state.css).toBe(`${line}\n`);
  });
  it('does nothing when the same fix is applied twice', () => {
    let state = editorReducer(editorReducer(undefined, cssChanged('')), fixApplied(fix));
    const once = state.css;
    state = editorReducer(state, fixApplied(fix));
    expect(state.css).toBe(once);
  });
});

describe('editorSlice size cap', () => {
  const empty = { ...editorReducer(undefined, { type: 'init' }), html: '', css: '' };

  it('accepts a page of exactly 500 KB', () => {
    const state = editorReducer(empty, htmlChanged('a'.repeat(MAX_PAGE_BYTES)));
    expect(state.html).toHaveLength(MAX_PAGE_BYTES);
    expect(state.rejected).toBeNull();
  });

  it('rejects HTML that would take the page over 500 KB, and keeps the old code', () => {
    const start = { ...empty, html: '<p>old</p>', css: 'p {}' };
    const state = editorReducer(start, htmlChanged('a'.repeat(MAX_PAGE_BYTES)));
    expect(state.html).toBe('<p>old</p>');
    expect(state.rejected).toEqual({ lang: 'html', bytes: MAX_PAGE_BYTES + 4 });
  });

  it('counts UTF-8 bytes, not characters', () => {
    // "₹" is 3 bytes in UTF-8: this text is a third of the cap in characters but over it in bytes.
    const state = editorReducer(empty, cssChanged('₹'.repeat(MAX_PAGE_BYTES / 3 + 1)));
    expect(state.css).toBe('');
    expect(state.rejected.lang).toBe('css');
  });

  it('clears the message after the next accepted edit', () => {
    let state = editorReducer(empty, htmlChanged('a'.repeat(MAX_PAGE_BYTES + 1)));
    expect(state.rejected).not.toBeNull();
    state = editorReducer(state, htmlChanged('<p>hi</p>'));
    expect(state).toMatchObject({ html: '<p>hi</p>', rejected: null });
  });
});
