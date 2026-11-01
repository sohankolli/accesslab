import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useLocation } from 'react-router';
import { useSettings } from '../../context/SettingsContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { htmlChanged, cssChanged, MAX_PAGE_BYTES } from '../editor/editorSlice';
import { issueSelected } from './auditSlice';
import { findElement, isPageLevel } from './overlayBoxes';
import { useAudit } from './useAudit';
import SourceEditor from '../editor/SourceEditor';
import { sourceLineOf } from '../editor/sourceLine';
import Splitter from '../../components/Splitter';
import { readPref, writePref } from '../../services/storage';
import './workbench.css';
import './sourcePane.css';
import PreviewPane from './PreviewPane';
import FindingsPane from './FindingsPane';

const DEFAULT_SIZES = { source: 28, issues: 29 }; // the mockup's 400 and 420px at 1440
const MIN_PREVIEW = 25; // percent: the splitters never squeeze the preview below this

/**
 * The workbench: source, preview and findings side by side, with splitters
 * between them. Typing updates the editor at once; the preview and the audit
 * wait for a pause.
 */
export default function Workbench() {
  const dispatch = useDispatch();
  const store = useStore();
  const { html, css, rejected } = useSelector((state) => state.editor);
  const result = useSelector((state) => state.audit.result);
  const selectedId = useSelector((state) => state.audit.selectedIssueId);
  const { reducedMotion } = useSettings();
  const docRef = useRef(null); // the live iframe Document: kept out of Redux
  const frameRef = useRef(null);
  const issuesHeadingRef = useRef(null);
  const editorRef = useRef(null);

  const auditHtml = useDebouncedValue(html, 400);
  const auditCss = useDebouncedValue(css, 400);
  const { rules, auditDocument } = useAudit({ docRef, html: auditHtml, css: auditCss });

  // The selected issue's line in the HTML source, highlighted in the editor. Only
  // while the editor holds exactly the code that was checked: mid-edit the line
  // could be stale, so no highlight is better than a wrong one.
  const highlight = useMemo(() => {
    const issue = selectedId && result?.issues.find((i) => i.id === selectedId);
    return issue && html === auditHtml ? sourceLineOf(html, issue.source) : null;
  }, [selectedId, result, html, auditHtml]);

  /**
   * "Show in code": select the issue's start tag in the HTML editor. It reads the
   * HTML from the store when clicked, so the function never changes while typing
   * and the memoised issue list does not re-render on every keystroke.
   */
  const showInCode = useCallback(
    (issue) => {
      const at = sourceLineOf(store.getState().editor.html, issue.source);
      editorRef.current?.reveal(at?.start ?? 0, at?.end ?? 0);
    },
    [store],
  );
  const focusIssuesHeading = useCallback(() => issuesHeadingRef.current?.focus(), []);

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
  useEffect(() => {
    writePref('paneSizes', sizes); // a convenience: if it is not saved, nothing breaks
  }, [sizes]);

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
        {rejected && (
          <div className="notice" role="alert">
            <p>
              <strong>That {rejected.lang === 'html' ? 'HTML' : 'CSS'} was not added.</strong> It
              would make the page {Math.ceil(rejected.bytes / 1024)} KB, and AccessLab checks pages
              up to {MAX_PAGE_BYTES / 1024} KB. Paste a smaller page or part of it.
            </p>
          </div>
        )}
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

      <PreviewPane
        html={auditHtml}
        css={auditCss}
        frameRef={frameRef}
        docRef={docRef}
        onDocument={auditDocument}
      />

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

      <FindingsPane
        hasRules={rules.length > 0}
        headingRef={issuesHeadingRef}
        onFixApplied={focusIssuesHeading}
        onShowIssue={showIssue}
        onShowInCode={showInCode}
      />
    </div>
  );
}
