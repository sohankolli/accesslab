import { acuityFor, SNELLEN_LINES } from '../audit/acuity';
import { SEVERITIES, SEVERITY_LABEL } from '../../components/severityLabels';
import './printReport.css';

const formatDate = (value) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(value);

function countIssues(issues = []) {
  return SEVERITIES.reduce(
    (counts, severity) => ({
      ...counts,
      [severity]: issues.filter((issue) => issue.severity === severity && !issue.needsReview)
        .length,
    }),
    {},
  );
}

function findingKey(issue) {
  return issue.id || `${issue.ruleId}:${issue.selector}`;
}

function compareFindings(beforeIssues = [], afterIssues = []) {
  const before = new Map(beforeIssues.map((issue) => [findingKey(issue), issue]));
  const after = new Map(afterIssues.map((issue) => [findingKey(issue), issue]));

  return {
    fixed: [...before.keys()].filter((key) => !after.has(key)).length,
    new: [...after.keys()].filter((key) => !before.has(key)).length,
    unchanged: [...after.keys()].filter((key) => before.has(key)).length,
  };
}

export default function PrintableReport({ run, beforeRun = null }) {
  if (!run) return null;

  const issues = run.issues ?? [];
  const counts = countIssues(issues);
  const acuity = acuityFor(run.score);
  const comparison = beforeRun ? compareFindings(beforeRun.issues ?? [], issues) : null;

  return (
    <section className="print-report" aria-label="Printable accessibility audit report">
      <header className="print-report__header">
        <p className="print-report__brand">ACCESSLAB</p>
        <h1>Accessibility Audit Report</h1>
        <p>Generated: {formatDate(run.ranAt)}</p>
      </header>

      <section className="print-report__score">
        <div>
          <p className="print-report__eyebrow">Accessibility score</p>
          <p className="print-report__number">
            {run.score}
            <span> / 100</span>
          </p>
          <p>
            Eye-chart reading: <strong>{acuity}</strong>
          </p>
        </div>

        <div className="print-report__chart" aria-label={`Eye chart reading ${acuity}`}>
          {SNELLEN_LINES.map((line) => (
            <p
              key={line.acuity}
              className={line.acuity === acuity ? 'is-reached' : ''}
              style={{ fontSize: Math.max(8, line.size * 0.55) }}
            >
              {line.letters}
              {line.acuity === acuity && <strong> {line.acuity}</strong>}
            </p>
          ))}
        </div>
      </section>

      <section>
        <h2>Findings summary</h2>
        <div className="print-report__counts">
          {SEVERITIES.map((severity) => (
            <p key={severity}>
              <strong>{counts[severity] ?? 0}</strong> {SEVERITY_LABEL[severity]}
            </p>
          ))}
          <p>
            <strong>{issues.filter((issue) => issue.needsReview).length}</strong> Needs manual
            review
          </p>
        </div>
      </section>

      {comparison && (
        <section className="print-report__comparison">
          <h2>Before and after improvement</h2>
          <p>
            Previous score: <strong>{beforeRun.score}</strong>
            {' → '}
            Current score: <strong>{run.score}</strong>
          </p>
          <p>
            Score change:{' '}
            <strong>
              {run.score - beforeRun.score > 0 ? '+' : ''}
              {run.score - beforeRun.score}
            </strong>
          </p>
          <ul>
            <li>Fixed findings: {comparison.fixed}</li>
            <li>New findings: {comparison.new}</li>
            <li>Unchanged findings: {comparison.unchanged}</li>
          </ul>
        </section>
      )}

      <section className="print-report__findings">
        <h2>Detailed findings ({issues.length})</h2>

        {issues.length === 0 ? (
          <p>No findings were recorded in this audit.</p>
        ) : (
          issues.map((issue, index) => (
            <article className="print-report__finding" key={issue.id ?? index}>
              <h3>
                {index + 1}. {issue.message}
              </h3>
              <p>
                <strong>Severity:</strong> {SEVERITY_LABEL[issue.severity] ?? issue.severity}
              </p>
              <p>
                <strong>Rule:</strong> {issue.ruleId}
              </p>
              <p>
                <strong>Element:</strong> <code>{issue.selector || 'Page-level finding'}</code>
              </p>
              {issue.snippet && (
                <p>
                  <strong>Element preview:</strong> <code>{issue.snippet}</code>
                </p>
              )}
              {issue.impact && (
                <p>
                  <strong>Impact:</strong> {issue.impact}
                </p>
              )}
              <p>
                <strong>Suggested fix:</strong> {issue.fix?.text || 'Review this element manually.'}
              </p>
              {issue.needsReview && (
                <p>
                  <strong>Manual review required.</strong>
                </p>
              )}
            </article>
          ))
        )}
      </section>

      <footer className="print-report__footer">
        <p>Generated by AccessLab · Accessibility Audit</p>
      </footer>
    </section>
  );
}
