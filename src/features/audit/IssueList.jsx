import { memo, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RULE_BY_ID } from '../../engine/rules';
import { selectSortedIssues } from './auditSlice';
import { fixApplied } from '../editor/editorSlice';
import { isPageLevel } from './overlayBoxes';
import IssueRow from './IssueRow';
import Severity from '../../components/Severity';
import { SEVERITIES } from '../../components/severityLabels';
import './issueList.css';

/**
 * Every finding from the latest check, numbered in one sequence (the same
 * numbers as the pins on the preview) and grouped by severity, most severe
 * first, with the items to check by hand last.
 * @param {{
 *   onFixApplied?: () => void,
 *   onShowIssue?: (issue: object|null) => void,
 *   onShowInCode?: (issue: object) => void,
 * }} props
 *   onFixApplied: called after a fix is applied, to move focus;
 *   onShowIssue: select an issue (or null to clear) and scroll the preview to it;
 *   onShowInCode: open the editor at the issue's element.
 * Memoised (see the export): it re-renders only when the audit result or the
 * selected issue changes, not on every keystroke in the editor. The parent must
 * pass stable callbacks (useCallback) for that to hold.
 */
function IssueList({ onFixApplied, onShowIssue, onShowInCode }) {
  const dispatch = useDispatch();
  const issues = useSelector(selectSortedIssues);
  const result = useSelector((state) => state.audit.result);
  const selectedId = useSelector((state) => state.audit.selectedIssueId);
  const listRef = useRef(null);

  // When an issue is selected by clicking in the preview, bring its row into view.
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const row = [...listRef.current.querySelectorAll('[data-issue-id]')].find(
      (el) => el.dataset.issueId === selectedId,
    );
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  if (!result) {
    // Placeholder rows with the size of real rows, so nothing jumps when they arrive.
    return (
      <div className="row-skeleton" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
    );
  }

  const numbered = issues.map((issue, i) => ({ issue, number: i + 1 }));
  const groups = [
    ...SEVERITIES.map((level) => ({
      key: level,
      title: <Severity level={level} />,
      rows: numbered.filter(({ issue }) => !issue.needsReview && issue.severity === level),
    })),
    {
      key: 'review',
      title: <span className="severity">Check by hand</span>,
      rows: numbered.filter(({ issue }) => issue.needsReview),
    },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="findings-list" ref={listRef}>
      {result.errors.length > 0 && (
        <div className="notice" role="note">
          <p>
            {result.errors.length === 1 ? 'One rule' : `${result.errors.length} rules`} could not
            run, so the score may be too high:{' '}
            {result.errors.map((e) => `${e.ruleId} (${e.error})`).join(', ')}.
          </p>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">Nothing to fix</p>
          <p>
            Every rule that is switched on passed. Automated checks cannot judge everything, so
            still try the page with a keyboard and a screen reader.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="group">
            <h3 className="group__title">
              {group.title}{' '}
              <span className="group__count">
                {group.rows.length}{' '}
                <span className="sr-only">{group.rows.length === 1 ? 'issue' : 'issues'}</span>
              </span>
            </h3>
            {/* start: the list numbers run on across groups, so a screen reader's
                "item 4" matches the visible number and the pin on the preview. */}
            <ol className="rows" start={group.rows[0].number}>
              {group.rows.map(({ issue, number }) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  number={number}
                  wcag={RULE_BY_ID[issue.ruleId]?.wcag}
                  open={issue.id === selectedId}
                  pageLevel={isPageLevel(issue)}
                  onToggle={() => onShowIssue?.(issue.id === selectedId ? null : issue)}
                  onApplyFix={() => {
                    dispatch(fixApplied({ ruleId: issue.ruleId, css: issue.fix.css }));
                    onFixApplied?.();
                  }}
                  onShowInCode={onShowInCode && (() => onShowInCode(issue))}
                />
              ))}
            </ol>
          </div>
        ))
      )}
    </div>
  );
}

export default memo(IssueList);
