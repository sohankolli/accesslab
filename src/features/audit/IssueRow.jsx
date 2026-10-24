// features/audit/IssueRow.jsx
import { useId } from 'react';
import CodeText from '../../components/CodeText';
import { wcagRefs, isBestPractice } from './wcagLinks';

/** The rule id and its WCAG criteria, each linked to W3C's explanation. */
function RuleRef({ ruleId, wcag }) {
  const refs = wcagRefs(wcag);
  return (
    <>
      {ruleId}
      {isBestPractice(wcag) && ', best practice'}
      {refs.map(({ number, url }, i) => (
        <span key={number}>
          {i === 0 ? (isBestPractice(wcag) ? ' related to ' : ', ') : ' and '}
          {url ? (
            <a className="wcag" href={url} target="_blank" rel="noreferrer">
              WCAG {number} <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            `WCAG ${number}`
          )}
        </span>
      ))}
    </>
  );
}

/**
 * One finding as a row: its number (the same as its pin on the preview), a
 * plain title and who it affects. The open row is the selected issue and
 * shows the element, the rule, the fix and the actions inline.
 * @param {{
 *   issue: import('../../engine/types.js').Issue, number: number, wcag?: string,
 *   open: boolean, pageLevel: boolean, onToggle: () => void,
 *   onApplyFix: () => void, onShowInCode?: () => void,
 * }} props
 */
export default function IssueRow({
  issue,
  number,
  wcag,
  open,
  pageLevel,
  onToggle,
  onApplyFix,
  onShowInCode,
}) {
  const detailId = useId();
  const tone = issue.needsReview ? 'review' : issue.severity;
  const fixColor = issue.fix.css && issue.fix.color;

  const applyFix = issue.fix.css && (
    <button type="button" className="btn btn--primary" onClick={onApplyFix}>
      {fixColor ? (
        <>
          Use <span className="swatch" style={{ background: fixColor }} aria-hidden="true" />
          {fixColor}
        </>
      ) : (
        'Apply fix'
      )}
    </button>
  );

  return (
    <li className={`row${open ? ' is-open' : ''}`} data-issue-id={issue.id}>
      <span className={`num num--${tone}`} aria-hidden="true">
        {number}
      </span>
      <div className="row__body">
        <h4 className="row__title">
          {/* The whole row is clickable: this button's ::after covers it. */}
          <button
            type="button"
            className="row__toggle"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            onClick={onToggle}
          >
            {/* The space sits outside the hidden span: name computation drops it inside. */}
            <span className="sr-only">{number}.</span> {issue.message}
          </button>
        </h4>
        <p className="row__why">
          {issue.contrast && (
            <span className="swatch" style={{ background: issue.contrast.fg }} aria-hidden="true" />
          )}
          <CodeText text={issue.impact ?? ''} />
        </p>
        {pageLevel && <p className="row__scope">Whole page</p>}

        {open ? (
          <div id={detailId} className="row__detail">
            <dl className="detail">
              <dt>Element</dt>
              <dd>
                <code>{issue.selector}</code>
              </dd>
              <dt>Rule</dt>
              <dd>
                <RuleRef ruleId={issue.ruleId} wcag={wcag} />
              </dd>
              <dt>Fix</dt>
              <dd>
                <CodeText text={issue.fix.text} />
              </dd>
            </dl>
            <div className="row__actions">
              {applyFix}
              {onShowInCode && (
                <button
                  type="button"
                  className={`btn${issue.fix.css ? '' : ' btn--primary'}`}
                  onClick={onShowInCode}
                >
                  Show in code
                </button>
              )}
            </div>
          </div>
        ) : (
          applyFix && <div className="row__actions">{applyFix}</div>
        )}
      </div>
    </li>
  );
}
