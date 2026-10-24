// features/audit/Workbench.jsx
import { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { runAudit } from '../../engine/runAudit';
import { RULES } from '../../engine/rules';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { htmlChanged, cssChanged } from '../editor/editorSlice';
import { auditStarted, auditCompleted } from './auditSlice';
import { runAdded } from '../report/historySlice';
import SandboxFrame from './SandboxFrame';
import IssueList from './IssueList';
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
  const docRef = useRef(null); // the live iframe Document: kept out of Redux

  // Typing updates the editor at once; the audit waits for a pause.
  const auditHtml = useDebouncedValue(html, 400);
  const auditCss = useDebouncedValue(css, 400);

  const handleDocument = useCallback(
    (doc) => {
      docRef.current = doc;
      dispatch(auditStarted());
      const audit = runAudit(doc, RULES);
      dispatch(auditCompleted(audit));
      dispatch(runAdded(audit));
    },
    [dispatch],
  );

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
          <SandboxFrame html={auditHtml} css={auditCss} onDocument={handleDocument} />
        </div>
      </section>

      <section className="workbench__issues" aria-labelledby="issues-heading">
        <h2 id="issues-heading">
          Issues <ScoreBadge score={result?.score} previousScore={previousScore} />
        </h2>
        <p className="sr-only" aria-live="polite">
          {result && announcement(result)}
        </p>
        <IssueList />
      </section>
    </div>
  );
}
