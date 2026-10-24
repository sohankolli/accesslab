// features/audit/Workbench.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Icon from '../../components/Icon';
import Segmented from '../../components/Segmented';
import Splitter from '../../components/Splitter';
import { readPref, writePref } from '../../services/storage';
import './workbench.css';

const DEFAULT_SIZES = { source: 28, issues: 30 };
const MIN_PREVIEW = 25; // percent: the splitters never squeeze the preview below this

const DEVICES = [
  { value: 'mobile', label: 'Mobile', icon: <Icon name="phone" /> },
  { value: 'tablet', label: 'Tablet', icon: <Icon name="tablet" /> },
  { value: 'desktop', label: 'Desktop', icon: <Icon name="monitor" /> },
];
const DEVICE_LABEL = { mobile: '390 px', tablet: '768 px', desktop: 'Full width' };

const lineCount = (text) => {
  const n = text.split('\n').length;
  return `${n} ${n === 1 ? 'line' : 'lines'}`;
};

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
  const [previewFocused, setPreviewFocused] = useState(false);
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
      <title>Audit · AccessLab</title>
      <h1 className="sr-only">Audit workbench</h1>

      <section id="pane-source" className="pane pane--source" aria-labelledby="source-heading">
        <div className="pane__header">
          <h2 id="source-heading" className="pane__title">
            Source
          </h2>
          <span className="pane__meta">Re-audits 400 ms after you stop typing</span>
        </div>
        {/* Plain textareas for now; CodeMirror replaces them in Milestone 3. */}
        <div className="pane__body editors">
          <div className="editor editor--html">
            <div className="editor__bar">
              <label htmlFor="html-input" className="editor__label">
                HTML
              </label>
              <span className="editor__meta tabular">{lineCount(html)}</span>
            </div>
            <textarea
              id="html-input"
              className="editor__input"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              value={html}
              onChange={(e) => dispatch(htmlChanged(e.target.value))}
            />
          </div>
          <div className="editor editor--css">
            <div className="editor__bar">
              <label htmlFor="css-input" className="editor__label">
                CSS
              </label>
              <span className="editor__meta tabular">{lineCount(css)}</span>
            </div>
            <textarea
              id="css-input"
              className="editor__input"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              value={css}
              onChange={(e) => dispatch(cssChanged(e.target.value))}
            />
          </div>
        </div>
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
        <div className="pane__header">
          <h2 id="preview-heading" className="pane__title">
            Preview
          </h2>
          <Segmented
            legend="Preview width"
            name="device"
            value={device}
            onChange={setDevice}
            options={DEVICES}
          />
        </div>
        <div className="pane__body preview-stage">
          <div className={`device device--${device}${previewFocused ? ' device--focused' : ''}`}>
            <div className="device__bar" aria-hidden="true">
              <span className="device__dots">
                <i />
                <i />
                <i />
              </span>
              <span className="tabular">{DEVICE_LABEL[device]}</span>
            </div>
            <SandboxFrame
              html={auditHtml}
              css={auditCss}
              onDocument={handleDocument}
              frameRef={frameRef}
            />
          </div>
          <IssueOverlay frameRef={frameRef} />
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

      <section id="pane-issues" className="pane pane--issues" aria-labelledby="issues-heading">
        <div className="pane__header">
          {/* tabIndex -1: "Apply fix" removes its own card after the re-audit, so
              focus moves here instead of being lost. */}
          <h2 id="issues-heading" className="pane__title" ref={issuesHeadingRef} tabIndex={-1}>
            Issues
          </h2>
          {/* Always rendered, only shown while auditing, so the header never shifts. */}
          <span
            className={`pane__status${status === 'running' ? ' is-active' : ''}`}
            aria-hidden="true"
          >
            <span className="pane__status-dot" />
            Auditing…
          </span>
        </div>
        <div className="pane__body issues-body">
          <ScoreBadge
            score={rules.length ? result?.score : undefined}
            previousScore={previousScore}
            issues={result?.issues}
            auditing={status === 'running'}
          />
          <p className="sr-only" aria-live="polite">
            {result && announcement(result)}
          </p>
          <PackSettings />
          {rules.length === 0 ? (
            <div className="empty-state">
              <Icon name="layers" size={40} className="icon empty-state__icon" />
              <p className="empty-state__title">All rule packs are off</p>
              <p>Nothing is being checked. Switch on a rule pack above to audit the page.</p>
            </div>
          ) : (
            <IssueList
              onFixApplied={() => issuesHeadingRef.current?.focus()}
              onShowIssue={showIssue}
            />
          )}
        </div>
      </section>
    </div>
  );
}
