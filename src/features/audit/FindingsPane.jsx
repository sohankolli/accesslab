import { useSelector } from 'react-redux';
import ScoreReading from './ScoreReading';
import PackSettings from './PackSettings';
import './findingsPane.css';
import IssueList from './IssueList';
import PrintableReport from '../report/PrintableReport';
import { downloadRunJSON, downloadRunCSV } from '../report/reportExport';

/** Text for the live region, read out by screen readers after every audit. */
function announcement(result) {
  const n = result.issues.length;
  return `Audit complete. Score ${result.score}. ${n} ${n === 1 ? 'issue' : 'issues'}.`;
}

/**
 * The findings pane: the score reading, the rule packs, an error notice when the
 * audit failed, and the numbered issue list.
 * @param {{
 *   hasRules: boolean,  false when every rule pack is switched off
 *   headingRef: import('react').Ref<HTMLHeadingElement>,
 *   onFixApplied: () => void, onShowIssue: (issue: object|null) => void,
 *   onShowInCode: (issue: object) => void,
 * }} props
 *   The callbacks must be stable (useCallback): the issue list is memoised.
 */
export default function FindingsPane({
  hasRules,
  headingRef,
  onFixApplied,
  onShowIssue,
  onShowInCode,
}) {
  const result = useSelector((state) => state.audit.result);
  const previousScore = useSelector((state) => state.audit.previousScore);
  const status = useSelector((state) => state.audit.status);
  const auditError = useSelector((state) => state.audit.error);

  return (
    <section id="pane-issues" className="pane pane--findings" aria-labelledby="issues-heading">
      <div className="pane__body findings">
        <ScoreReading
          score={hasRules ? result?.score : undefined}
          previousScore={previousScore}
          issues={hasRules ? result?.issues : []}
          auditing={status === 'running'}
          failed={status === 'failed'}
          headingRef={headingRef}
        />

        {result && (
          <>
            <div className="findings__report-actions">
              <button type="button" className="btn" onClick={() => downloadRunJSON(result)}>
                Download JSON
              </button>

              <button type="button" className="btn" onClick={() => downloadRunCSV(result)}>
                Download CSV
              </button>

              <button type="button" className="btn" onClick={() => window.print()}>
                Print / Save PDF
              </button>
            </div>

            <PrintableReport run={result} />
          </>
        )}
        <p className="sr-only" aria-live="polite">
          {result && announcement(result)}
        </p>
        <PackSettings />
        {status === 'failed' && (
          <div className="notice" role="alert">
            <p>
              <strong>The page could not be checked.</strong> {auditError?.replace(/\.$/, '')}.{' '}
              {result
                ? 'The findings below are from the last check that worked.'
                : 'No findings are shown.'}{' '}
              Edit the code to try again.
            </p>
          </div>
        )}
        {!hasRules ? (
          <div className="empty-state">
            <p className="empty-state__title">All rule packs are off</p>
            <p>Nothing is being checked. Switch on a rule pack above to audit the page.</p>
          </div>
        ) : status === 'failed' && !result ? null : (
          <IssueList
            onFixApplied={onFixApplied}
            onShowIssue={onShowIssue}
            onShowInCode={onShowInCode}
          />
        )}
      </div>
    </section>
  );
}
