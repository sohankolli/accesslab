// components/IssueCard.jsx
import Icon from './Icon';
import Severity from './Severity';

/**
 * One issue: severity, message, rule and WCAG reference, the element's selector
 * and snippet, the fix, and the actions.
 * @param {{
 *   issue: import('../engine/types.js').Issue, wcag?: string, selected: boolean,
 *   onApplyFix?: () => void, onShow?: () => void,
 * }} props  onShow is left out for page-level issues, which have nothing to show.
 */
export default function IssueCard({ issue, wcag, selected, onApplyFix, onShow }) {
  return (
    <li className={`issue-card${selected ? ' is-selected' : ''}`} data-issue-id={issue.id}>
      <div className="issue-card__top">
        {issue.needsReview ? (
          <span className="severity severity--minor">
            <Icon name="eye" />
            Needs review
          </span>
        ) : (
          <Severity level={issue.severity} />
        )}{' '}
        <span className="issue-card__meta">
          <code>{issue.ruleId}</code> <span aria-hidden="true">·</span>{' '}
          <span>{wcag ?? 'Best practice'}</span>
        </span>
      </div>
      <h4 className="issue-card__title">{issue.message}</h4>
      <dl className="issue-card__details">
        <div>
          <dt>Element</dt>
          <dd>
            <code>{issue.selector}</code>
          </dd>
        </div>
        <div>
          <dt>Snippet</dt>
          <dd>
            <pre className="snippet">
              <code>{issue.snippet}</code>
            </pre>
          </dd>
        </div>
        <div>
          <dt>Fix</dt>
          <dd>{issue.fix.text}</dd>
        </div>
      </dl>
      {(issue.fix.css || onShow) && (
        <div className="issue-card__actions">
          {issue.fix.css && (
            <button type="button" className="btn btn--primary" onClick={onApplyFix}>
              <Icon name="sparkle" />
              Apply fix
            </button>
          )}
          {onShow && (
            <button type="button" className="btn" aria-pressed={selected} onClick={onShow}>
              <Icon name="eye" />
              Show in preview
            </button>
          )}
        </div>
      )}
    </li>
  );
}
