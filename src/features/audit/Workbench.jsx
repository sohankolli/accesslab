// features/audit/Workbench.jsx
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { toAuditResult } from '../../engine/runAudit';
import { runRulesSliced } from '../../engine/scheduler';
import { rulesFor } from '../../engine/rules';
import { useSettings } from '../../context/SettingsContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { htmlChanged, cssChanged } from '../editor/editorSlice';
import { auditStarted, auditCompleted, issueSelected, selectSortedIssues } from './auditSlice';
import { runAdded } from '../report/historySlice';
import SandboxFrame from './SandboxFrame';
import IssueList from './IssueList';
import PackSettings from './PackSettings';
import IssueOverlay from './IssueOverlay';
import { findElement, issueAt } from './overlayBoxes';
import ScoreBadge from '../../components/ScoreBadge';
import './workbench.css';

/** Text for the live region, read out by screen readers after every audit. */
function announcement(result) {
  const n = result.issues.length;
  return `Audit complete. Score ${result.score}. ${n} ${n === 1 ? 'issue' : 'issues'}.`;
}

export default function Workbench() {
  const dispatch = useDispatch();
  const { html, css } = useSelector((state) => state.editor);
  const result = useSelector((state) => state.audit.result);
  const previousScore = useSelector((state) => state.audit.previousScore);
  const store = useStore();
  const docRef = useRef(null); // the live iframe Document: kept out of Redux
  const frameRef = useRef(null);
  const issuesHeadingRef = useRef(null);

  // Typing updates the editor at once; the audit waits for a pause.
  const auditHtml = useDebouncedValue(html, 400);
  const auditCss = useDebouncedValue(css, 400);

  // Only the rule packs switched on in settings take part in the audit.
  const { enabledPacks, reducedMotion } = useSettings();
  const rules = useMemo(() => rulesFor(enabledPacks), [enabledPacks]);

  // The running audit's controller. Starting a new audit aborts the old one, so
  // a stale result never reaches Redux or the history.
  const auditControllerRef = useRef(null);

  const auditDocument = useCallback(
    async (doc) => {
      auditControllerRef.current?.abort();
      const controller = new AbortController();
      auditControllerRef.current = controller;
      dispatch(auditStarted());
      try {
        // Runs in ~12 ms slices, yielding to the browser in between so typing stays smooth.
        const results = await runRulesSliced(doc, rules, { signal: controller.signal });
        if (controller.signal.aborted) return; // superseded while the last rule ran
        const audit = toAuditResult(results);
        dispatch(auditCompleted(audit));
        dispatch(runAdded(audit));
      } catch (err) {
        if (err.name !== 'AbortError') throw err;
      }
    },
    [dispatch, rules],
  );

  // New code is about to replace the preview's document: stop auditing the old
  // one now rather than when the new one has loaded. Also stops on unmount.
  useEffect(() => () => auditControllerRef.current?.abort(), [auditHtml, auditCss]);

  const handleDocument = useCallback(
    (doc) => {
      docRef.current = doc;
      // AccessLab's own listeners (the page's scripts still never run). A click
      // selects the issue under the pointer, and neither links nor forms may
      // navigate the frame away from the page being audited.
      doc.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          const hit = issueAt(event.target, selectSortedIssues(store.getState()));
          dispatch(issueSelected(hit?.id ?? null));
        },
        true,
      );
      doc.addEventListener('submit', (event) => event.preventDefault(), true);
      auditDocument(doc);
    },
    [auditDocument, dispatch, store],
  );

  /** Select an issue from the list and scroll the preview so its element is centred. */
  const showIssue = useCallback(
    (issue) => {
      dispatch(issueSelected(issue?.id ?? null));
      const doc = docRef.current;
      const el = issue && doc && findElement(doc, issue.selector);
      if (!el) return;
      // win.scrollTo, not el.scrollIntoView(): that would scroll AccessLab's page too.
      const win = doc.defaultView;
      const r = el.getBoundingClientRect();
      win.scrollTo({
        top: win.scrollY + r.top - win.innerHeight / 2 + r.height / 2,
        left: win.scrollX + r.left - win.innerWidth / 2 + r.width / 2,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    },
    [dispatch, reducedMotion],
  );

  // Switching a pack on or off re-audits the page already in the preview.
  useEffect(() => {
    if (docRef.current) auditDocument(docRef.current);
  }, [auditDocument]);

  return (
    <div className="workbench">
      <title>Audit · AccessLab</title>
      <h1 className="sr-only">Audit workbench</h1>

      <section className="workbench__editor" aria-labelledby="source-heading">
        <h2 id="source-heading">Source</h2>
        {/* Plain textareas for Milestone 1; CodeMirror replaces them later. */}
        <label htmlFor="html-input">HTML</label>
        <textarea
          id="html-input"
          className="code-input"
          rows={16}
          spellCheck={false}
          value={html}
          onChange={(e) => dispatch(htmlChanged(e.target.value))}
        />
        <label htmlFor="css-input">CSS</label>
        <textarea
          id="css-input"
          className="code-input"
          rows={8}
          spellCheck={false}
          value={css}
          onChange={(e) => dispatch(cssChanged(e.target.value))}
        />
      </section>

      <section className="workbench__preview" aria-labelledby="preview-heading">
        <h2 id="preview-heading">Preview</h2>
        <div className="preview-stage">
          <SandboxFrame
            html={auditHtml}
            css={auditCss}
            onDocument={handleDocument}
            frameRef={frameRef}
          />
          <IssueOverlay frameRef={frameRef} />
        </div>
      </section>

      <section className="workbench__issues" aria-labelledby="issues-heading">
        {/* tabIndex -1: "Apply fix" removes its own card after the re-audit, so
            focus moves here instead of being lost. */}
        <h2 id="issues-heading" ref={issuesHeadingRef} tabIndex={-1}>
          Issues <ScoreBadge score={result?.score} previousScore={previousScore} />
        </h2>
        <p className="sr-only" aria-live="polite">
          {result && announcement(result)}
        </p>
        <PackSettings />
        {rules.length === 0 ? (
          <p>All rule packs are switched off, so nothing is checked. Switch a pack on above.</p>
        ) : (
          <IssueList
            onFixApplied={() => issuesHeadingRef.current?.focus()}
            onShowIssue={showIssue}
          />
        )}
      </section>
    </div>
  );
}
