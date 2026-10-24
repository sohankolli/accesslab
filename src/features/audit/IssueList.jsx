// features/audit/IssueList.jsx
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RULE_BY_ID } from '../../engine/rules';
import { selectSortedIssues } from './auditSlice';
import { fixApplied } from '../editor/editorSlice';
import { isPageLevel } from './overlayBoxes';
import IssueCard from '../../components/IssueCard';
import Icon from '../../components/Icon';
import Severity from '../../components/Severity';
import { SEVERITIES } from '../../components/severityLabels';

/**
 * Every issue from the latest audit, grouped by severity (most severe first)
 * in collapsible groups.
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

  // When an issue is selected by clicking in the preview, open its group and
  // bring its card into view.
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const card = [...listRef.current.querySelectorAll('[data-issue-id]')].find(
      (el) => el.dataset.issueId === selectedId,
    );
    if (!card) return;
    const group = card.closest('details');
    if (group) group.open = true;
    card.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  if (!result) {
    // Placeholder rows with the size of real cards, so nothing jumps when they arrive.
    return (
      <div className="issue-skeleton" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
    );
  }

  const groups = SEVERITIES.map((level) => [
    level,
    issues.filter((i) => i.severity === level),
  ]).filter(([, list]) => list.length > 0);

  return (
    <div className="issue-groups" ref={listRef}>
      {result.errors.length > 0 && (
        <div className="notice" role="note">
          <Icon name="serious" />
          <p>
            {result.errors.length === 1 ? 'One rule' : `${result.errors.length} rules`} could not
            run, so the score may be too high:{' '}
            {result.errors.map((e) => `${e.ruleId} (${e.error})`).join(', ')}.
          </p>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty-state">
          <Icon name="check" size={40} className="icon empty-state__icon" />
          <p className="empty-state__title">No issues: score {result.score}</p>
          <p>
            Every enabled rule passed. Automated rules cannot judge everything, so still check the
            page with a keyboard and a screen reader.
          </p>
        </div>
      ) : (
        groups.map(([level, list]) => (
          <details key={level} className="issue-group" open>
            <summary className="issue-group__summary">
              <h3 className="issue-group__title">
                <Severity level={level} />{' '}
                <span className="issue-group__count tabular">
                  {list.length}
                  <span className="sr-only">{list.length === 1 ? ' issue' : ' issues'}</span>
                </span>
              </h3>
              <Icon name="chevron" className="icon issue-group__chevron" />
            </summary>
            <ol className="issue-list">
              {list.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  wcag={RULE_BY_ID[issue.ruleId]?.wcag}
                  selected={issue.id === selectedId}
                  onApplyFix={() => {
                    dispatch(fixApplied({ ruleId: issue.ruleId, css: issue.fix.css }));
                    onFixApplied?.();
                  }}
                  onShow={
                    isPageLevel(issue)
                      ? undefined
                      : () => onShowIssue?.(issue.id === selectedId ? null : issue)
                  }
                />
              ))}
            </ol>
          </details>
        ))
      )}
    </div>
  );
}
