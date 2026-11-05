import { memo, useId, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { dismissedCleared, LOW_CONFIDENCE, notAnIssue, selectAdvisory } from './clickablesSlice';
import { selectSortedIssues } from './auditSlice';
import { fixSnippets } from './fixSnippet';
import { downloadFeedback } from './feedback';
import './clickables.css';

/** Copy text, and say whether it worked: clipboard access can be refused. */
function CopyButton({ text, label }) {
  const [state, setState] = useState(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('Copied');
    } catch (err) {
      setState(`Could not copy (${err?.name ?? 'blocked'}): select the code and copy it`);
    }
  };
  return (
    <>
      <button type="button" className="btn" onClick={copy}>
        {label}
      </button>
      {state && (
        <span className="copy-status" role="status">
          {state}
        </span>
      )}
    </>
  );
}

function AdvisoryRow({ finding, number, open, onToggle, onShowInCode, onNotAnIssue }) {
  const detailId = useId();
  const percent = Math.round(finding.p * 100);
  const fix = fixSnippets(finding);
  return (
    <li className={`row row--advisory${open ? ' is-open' : ''}`} data-issue-id={finding.id}>
      <span className="row__num row__num--advisory" aria-hidden="true">
        {number}
      </span>
      <div className="row__body">
        <h4 className="row__title">
          <button
            type="button"
            className="row__toggle"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            onClick={onToggle}
          >
            <span className="sr-only">{number}.</span> Looks like a button but is not one ({percent}
            %)
          </button>
        </h4>
        <p className="row__why">
          A mouse can click it, but a keyboard cannot reach it and a screen reader does not call it
          a button.
        </p>
        {open && (
          <div id={detailId} className="row__detail">
            <dl className="detail">
              <dt>Element</dt>
              <dd>
                <code>{finding.selector}</code>
              </dd>
              <dt>Why we think so</dt>
              <dd>
                {finding.cues.length ? (
                  <ul className="cues">
                    {finding.cues.map((c) => (
                      <li key={c.id}>{c.text}</li>
                    ))}
                  </ul>
                ) : (
                  'Many small cues together; no single one stood out.'
                )}
              </dd>
              <dt>Rule</dt>
              <dd>
                Model suggestion, related to WCAG 2.1.1 and 4.1.2. It is advisory and does not
                change the score. The scripts that would make it clickable do not run in the
                preview, so check it in the live page.
              </dd>
              <dt>Fix</dt>
              <dd>
                Use a <code>&lt;button&gt;</code>:
                <pre className="fix-code">
                  <code>{fix.button}</code>
                </pre>
                If it must stay a <code>&lt;{finding.tag}&gt;</code>: add{' '}
                <code>role=&quot;button&quot;</code>, <code>tabindex=&quot;0&quot;</code> and an
                Enter and Space key handler:
                <pre className="fix-code">
                  <code>{fix.keep}</code>
                </pre>
              </dd>
            </dl>
            <div className="row__actions">
              <CopyButton text={`${fix.button}\n\n${fix.keep}`} label="Copy the fix" />
              {onShowInCode && (
                <button type="button" className="btn" onClick={onShowInCode}>
                  Show in code
                </button>
              )}
              <button type="button" className="btn" onClick={onNotAnIssue}>
                Not an issue
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * "Possibly click-only": the model's advisory findings, numbered on from the
 * rule findings (the same numbers as their pins on the preview).
 * @param {{onShowIssue?: (f: object|null) => void, onShowInCode?: (f: object) => void}} props
 *   Stable callbacks, as for IssueList.
 */
function ClickablesGroup({ onShowIssue, onShowInCode }) {
  const dispatch = useDispatch();
  const findings = useSelector(selectAdvisory);
  const ruleCount = useSelector(selectSortedIssues).length;
  const selectedId = useSelector((s) => s.audit.selectedIssueId);
  const dismissed = useSelector((s) => s.clickables.dismissed);
  const modelVersion = useSelector((s) => s.clickables.model?.version);
  const on = findings.length > 0;

  if (!on && dismissed.length === 0) return null;
  return (
    <div className="group group--advisory">
      {on && (
        <>
          <h3 className="group__title">
            <span className="severity">
              <span className="advisory-shape" aria-hidden="true" />
              Possibly click-only
            </span>{' '}
            <span className="group__count">
              {findings.length}{' '}
              <span className="sr-only">
                {findings.length === 1 ? 'suggestion' : 'suggestions'}
              </span>
            </span>
          </h3>
          <p className="group__note">
            <strong>{LOW_CONFIDENCE}</strong> Suggestions never change the score.
          </p>
          <ol className="rows" start={ruleCount + 1}>
            {findings.map((f, i) => (
              <AdvisoryRow
                key={f.id}
                finding={f}
                number={ruleCount + i + 1}
                open={f.id === selectedId}
                onToggle={() => onShowIssue?.(f.id === selectedId ? null : f)}
                onShowInCode={onShowInCode && (() => onShowInCode(f))}
                onNotAnIssue={() => {
                  dispatch(notAnIssue(f));
                  onShowIssue?.(null);
                }}
              />
            ))}
          </ol>
        </>
      )}
      {dismissed.length > 0 && (
        <div className="feedback">
          <p>
            {dismissed.length} {dismissed.length === 1 ? 'suggestion' : 'suggestions'} marked
            &ldquo;Not an issue&rdquo; in this browser.
          </p>
          <div className="row__actions">
            <button
              type="button"
              className="btn"
              onClick={() => downloadFeedback(dismissed, modelVersion)}
            >
              Export as JSON
            </button>
            <button type="button" className="btn" onClick={() => dispatch(dismissedCleared())}>
              Show them again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ClickablesGroup);
