// features/audit/IssueList.jsx
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RULE_BY_ID } from '../../engine/rules';
import { selectSortedIssues } from './auditSlice';
import { fixApplied } from '../editor/editorSlice';
import { isPageLevel } from './overlayBoxes';

const SEVERITY_LABEL = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
};

/**
 * Every issue from the latest audit, most severe first.
 * @param {{onFixApplied?: () => void, onShowIssue?: (issue: object|null) => void}} props
 *   onFixApplied: called after "Apply fix", to move focus;
 *   onShowIssue: select an issue (or null to clear) and scroll the preview to it.
 */
export default function IssueList({ onFixApplied, onShowIssue }) {
  const dispatch = useDispatch();
  const issues = useSelector(selectSortedIssues);
  const result = useSelector((state) => state.audit.result);
  const selectedId = useSelector((state) => state.audit.selectedIssueId);
  const listRef = useRef(null);

  // When an issue is selected by clicking in the preview, bring its card into view.
  useEffect(() => {
    if (!selectedId) return;
    const card = [...(listRef.current?.children ?? [])].find(
      (li) => li.dataset.issueId === selectedId,
    );
    card?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  if (!result) return <p>The audit runs as soon as the preview has loaded.</p>;

  return (
    <>
      {result.errors.length > 0 && (
        <p className="issue-list__errors">
          {result.errors.length} rule(s) could not run:{' '}
          {result.errors.map((e) => `${e.ruleId} (${e.error})`).join(', ')}.
        </p>
      )}
      {issues.length === 0 ? (
        <p>No issues found by the automated rules. Some problems can only be found by a person.</p>
      ) : (
        <ol className="issue-list" ref={listRef}>
          {issues.map((issue) => (
            <li
              key={issue.id}
              data-issue-id={issue.id}
              className={`issue${issue.id === selectedId ? ' issue--selected' : ''}`}
            >
              {/* Severity is spelled out in text; the colour only repeats it. */}
              <p className={`issue__severity issue__severity--${issue.severity}`}>
                {SEVERITY_LABEL[issue.severity]}
              </p>
              <h3 className="issue__message">{issue.message}</h3>
              <dl className="issue__details">
                <dt>Rule</dt>
                <dd>
                  <code>{issue.ruleId}</code>
                </dd>
                <dt>WCAG</dt>
                <dd>{RULE_BY_ID[issue.ruleId]?.wcag ?? 'Best practice'}</dd>
                <dt>Element</dt>
                <dd>
                  <code>{issue.selector}</code>
                </dd>
                <dt>Fix</dt>
                <dd>{issue.fix.text}</dd>
              </dl>
              {issue.fix.css && (
                <button
                  type="button"
                  onClick={() => {
                    dispatch(fixApplied({ ruleId: issue.ruleId, css: issue.fix.css }));
                    onFixApplied?.();
                  }}
                >
                  Apply fix
                </button>
              )}
              {!isPageLevel(issue) && (
                <button
                  type="button"
                  aria-pressed={issue.id === selectedId}
                  onClick={() => onShowIssue?.(issue.id === selectedId ? null : issue)}
                >
                  Show in preview
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
