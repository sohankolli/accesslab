// features/audit/Workbench.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useLocation } from 'react-router';
import { toAuditResult } from '../../engine/runAudit';
import { runRulesSliced } from '../../engine/scheduler';
import { rulesFor } from '../../engine/rules';
import { useSettings } from '../../context/SettingsContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { htmlChanged, cssChanged } from '../editor/editorSlice';
import {
  auditStarted,
  auditCompleted,
  issueSelected,
  selectSortedIssues,
  simulationChanged,
} from './auditSlice';
import { runAdded } from '../report/historySlice';
import SandboxFrame from './SandboxFrame';
import IssueList from './IssueList';
import PackSettings from './PackSettings';
import IssueOverlay from './IssueOverlay';
import { findElement, issueAt, isPageLevel } from './overlayBoxes';
import SourceEditor from '../editor/SourceEditor';
import { sourceLineOf } from '../editor/sourceLine';
import ScoreReading from './ScoreReading';
import Segmented from '../../components/Segmented';
import Splitter from '../../components/Splitter';
import { readPref, writePref } from '../../services/storage';
import './workbench.css';
import { SIMULATIONS } from '../simulate/simulations';
const DEFAULT_SIZES = { source: 28, issues: 29 }; // the mockup's 400 and 420px at 1440
const MIN_PREVIEW = 25; // percent: the splitters never squeeze the preview below this

const DEVICES = [
  { value: 'mobile', label: 'Phone' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'desktop', label: 'Desktop' },
];


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
  const [previewFocused, setPreviewFocused] = useState(false);
  const [pageTitle, setPageTitle] = useState('Preview');
  const [frameSize, setFrameSize] = useState(null);
  const docRef = useRef(null); // the live iframe Document: kept out of Redux
  const frameRef = useRef(null);
  const issuesHeadingRef = useRef(null);
  const editorRef = useRef(null);
  const selectedId = useSelector((state) => state.audit.selectedIssueId);
  const simulation = useSelector((state) => state.audit.simulation);
  // Typing updates the editor at once; the audit waits for a pause.
  const auditHtml = useDebouncedValue(html, 400);
  const auditCss = useDebouncedValue(css, 400);

  // The selected issue's line in the HTML source, highlighted in the editor. Only
  // while the editor holds exactly the code that was checked: mid-edit the line
  // could be stale, so no highlight is better than a wrong one.
  const highlight = useMemo(() => {
    const issue = selectedId && result?.issues.find((i) => i.id === selectedId);
    return issue && html === auditHtml ? sourceLineOf(html, issue.source) : null;
  }, [selectedId, result, html, auditHtml]);

  /** "Show in code": select the issue's start tag in the HTML editor. */
  const showInCode = useCallback(
    (issue) => {
      const at = sourceLineOf(html, issue.source);
      editorRef.current?.reveal(at?.start ?? 0, at?.end ?? 0);
    },
    [html],
  );

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
      setPageTitle(doc.title.trim() || 'Untitled page');
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
      // Show a focus ring on the device frame while keyboard focus is inside the preview.
      doc.defaultView.addEventListener('focus', () => setPreviewFocused(true));
      doc.defaultView.addEventListener('blur', () => setPreviewFocused(false));
      auditDocument(doc);
    },
    [auditDocument, dispatch, store],
  );

  /** Select an issue from the list and scroll the preview so its element is centred. */
  const showIssue = useCallback(
    (issue) => {
      dispatch(issueSelected(issue?.id ?? null));
      const doc = docRef.current;
      const el = issue && doc && !isPageLevel(issue) && findElement(doc, issue.selector);
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

  // The preview's size in CSS pixels, shown under it.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const observer = new ResizeObserver(() =>
      setFrameSize({ width: frame.clientWidth, height: frame.clientHeight }),
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // "Check a page" on Home: focus the HTML editor with its text selected, so a
  // paste replaces it. After a tick, because the layout moves focus to <main>
  // when the route changes.
  const location = useLocation();
  useEffect(() => {
    if (!location.state?.paste) return undefined;
    const timer = setTimeout(() => {
      const input = document.getElementById('html-input');
      input?.focus();
      input?.select();
    }, 0);
    return () => clearTimeout(timer);
  }, [location]);

  // Pane widths (percent of the workbench), adjustable with the splitters and remembered.
  const workbenchRef = useRef(null);
  const [sizes, setSizes] = useState(() => ({ ...DEFAULT_SIZES, ...readPref('paneSizes') }));
  useEffect(() => writePref('paneSizes', sizes), [sizes]);
  const [device, setDevice] = useState('desktop');
  const status = useSelector((state) => state.audit.status);

  return (
    <div
      className="workbench"
      ref={workbenchRef}
      style={{ '--source-w': `${sizes.source}%`, '--issues-w': `${sizes.issues}%` }}
    >
      <title>Workbench – AccessLab</title>
      <h1 className="sr-only">Audit workbench</h1>

      <section id="pane-source" className="pane pane--source" aria-labelledby="source-heading">
        <h2 id="source-heading" className="sr-only">
          Source
        </h2>
        <SourceEditor
          html={html}
          css={css}
          onHtmlChange={(v) => dispatch(htmlChanged(v))}
          onCssChange={(v) => dispatch(cssChanged(v))}
          highlight={highlight}
          controlRef={editorRef}
        />
      </section>

      <Splitter
        label="Resize source pane"
        controls="pane-source"
        edge="start"
        value={sizes.source}
        min={18}
        max={Math.min(45, 100 - MIN_PREVIEW - sizes.issues)}
        onChange={(source) => setSizes((s) => ({ ...s, source }))}
        containerRef={workbenchRef}
      />

      <section id="pane-preview" className="pane pane--preview" aria-labelledby="preview-heading">
        <div className="lb-head">
          <h2 id="preview-heading" className="lb-head__title">
            {pageTitle} <span>as rendered, scripts off</span>
          </h2>
          <Segmented
            legend="Preview width"
            name="device"
            value={device}
            onChange={setDevice}
            options={DEVICES}
          />
          <label className="simulation-control">
            <span>Vision simulation</span>
             <select
                value={simulation}
                onChange={(event) => dispatch(simulationChanged(event.target.value))}
  >
                {SIMULATIONS.map((option) => (
                 <option key={option.value} value={option.value}>
                  {option.label}
                 </option>
            ))}
          </select>
        </label>
        </div>
        <div className="preview-stage">
        <div
          className={`sheet sheet--${device}${previewFocused ? ' sheet--focused' : ''} simulation--${simulation}`}
        >
            <SandboxFrame
              html={auditHtml}
              css={auditCss}
              simulation={simulation}
              onDocument={handleDocument}
              frameRef={frameRef}
            />
          </div>
          <IssueOverlay frameRef={frameRef} />
        </div>
        <div className="lb-foot">
          <span>Click a marked element to open its finding</span>
          {frameSize && (
            <span>
              {frameSize.width} × {frameSize.height} <span className="sr-only">pixels</span>
            </span>
          )}
        </div>
      </section>

      <Splitter
        label="Resize issues pane"
        controls="pane-issues"
        edge="end"
        value={sizes.issues}
        min={22}
        max={Math.min(45, 100 - MIN_PREVIEW - sizes.source)}
        onChange={(issues) => setSizes((s) => ({ ...s, issues }))}
        containerRef={workbenchRef}
      />

      <section id="pane-issues" className="pane pane--findings" aria-labelledby="issues-heading">
        <div className="pane__body findings">
          <ScoreReading
            score={rules.length ? result?.score : undefined}
            previousScore={previousScore}
            issues={rules.length ? result?.issues : []}
            auditing={status === 'running'}
            headingRef={issuesHeadingRef}
          />
          <p className="sr-only" aria-live="polite">
            {result && announcement(result)}
          </p>
          <PackSettings />
          {rules.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">All rule packs are off</p>
              <p>Nothing is being checked. Switch on a rule pack above to audit the page.</p>
            </div>
          ) : (
            <IssueList
              onFixApplied={() => issuesHeadingRef.current?.focus()}
              onShowIssue={showIssue}
              onShowInCode={showInCode}
            />
          )}
        </div>
      </section>
    </div>
  );
}
