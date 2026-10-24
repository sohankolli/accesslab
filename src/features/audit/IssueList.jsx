// features/audit/IssueList.jsx
import { useSelector } from 'react-redux';
import { RULE_BY_ID } from '../../engine/rules';
import { selectSortedIssues } from './auditSlice';

const SEVERITY_LABEL = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
};

/** Every issue from the latest audit, most severe first. */
export default function IssueList() {
  const issues = useSelector(selectSortedIssues);
  const result = useSelector((state) => state.audit.result);

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
        <ol className="issue-list">
          {issues.map((issue) => (
            <li key={issue.id} className="issue">
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
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
