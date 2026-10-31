// features/report/Report.jsx
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router';
import { historyCleared } from './historySlice';
import { compareRuns, describeCountChange, describeScoreChange } from './compareRuns';
import TrendChart from './TrendChart';
import Severity from '../../components/Severity';
import { SEVERITIES, SEVERITY_LABEL } from '../../components/severityLabels';
import './report.css';

const formatTime = (ms) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
const formatShort = (ms) => new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(ms);

/** /report and /report/:runId. Keyed by runId so a new link resets the comparison. */
export default function Report() {
  const { runId } = useParams();
  return <ReportView key={runId ?? 'latest'} runId={runId} />;
}

function ReportView({ runId }) {
  const dispatch = useDispatch();
  const runs = useSelector((state) => state.history.runs); // newest first
  const saveFailed = useSelector((state) => state.history.saveFailed);
  const saveNotice = saveFailed && (
    <div className="notice" role="note">
      <p>
        <strong>History can’t be saved in this browser.</strong> Storage is full or blocked, so
        these checks are lost when you close or reload the tab.
      </p>
    </div>
  );

  // Default comparison: the latest run (or the one named in /report/:runId) as
  // "after", and the run just before it as "before" (the next newer one if it is the oldest).
  const [afterId, setAfterId] = useState(() =>
    runs.some((r) => r.id === runId) ? runId : runs[0]?.id,
  );
  const [beforeId, setBeforeId] = useState(() => {
    const i = runs.findIndex((r) => r.id === afterId);
    return (runs[i + 1] ?? runs[i - 1] ?? runs[i])?.id;
  });
  const after = runs.find((r) => r.id === afterId) ?? runs[0];
  const before = runs.find((r) => r.id === beforeId) ?? runs[1] ?? runs[0];

  if (runs.length === 0) {
    return (
      <div className="page page--narrow">
        <title>Report – AccessLab</title>
        <div className="page__header">
          <h1 className="page__title">Report</h1>
        </div>
        {saveNotice}
        <div className="empty-state">
          <h2 className="empty-state__title">No checks yet</h2>
          <p>Every check the workbench runs is recorded here, with its score and findings.</p>
          <Link to="/audit" className="btn btn--primary">
            Open the workbench
          </Link>
        </div>
      </div>
    );
  }

  const diff = compareRuns(before, after);
  const runLabel = (run) => `${formatTime(run.ranAt)}, score ${run.score}`;
  const totalIssues = (run) => SEVERITIES.reduce((n, s) => n + (run.counts[s] ?? 0), 0);

  return (
    <div className="page report">
      <title>Report – AccessLab</title>
      <div className="page__header">
        <div>
          <h1 className="page__title">Report</h1>
          <p className="page__lead">
            Your last {runs.length} {runs.length === 1 ? 'check' : 'checks'}, saved in this browser.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (window.confirm('Delete all saved checks?')) dispatch(historyCleared());
          }}
        >
          Clear history
        </button>
      </div>
      {saveNotice}

      <section className="section" aria-labelledby="trend-heading">
        <h2 id="trend-heading" className="section__title">
          Score trend
        </h2>
        <TrendChart runs={runs} />
      </section>

      <section className="section" aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="section__title">
          Before and after
        </h2>
        <div className="compare-pickers">
          <label className="field">
            <span className="field__label">Before</span>
            <select value={before.id} onChange={(e) => setBeforeId(e.target.value)}>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {runLabel(run)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">After</span>
            <select value={after.id} onChange={(e) => setAfterId(e.target.value)}>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {runLabel(run)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="compare">
          <p className="compare__scores">
            <span className="compare__score">
              <span className="compare__caption">Before</span>{' '}
              <span className="compare__value">{diff.score.before}</span>
            </span>
            <span className="compare__arrow" aria-hidden="true">
              →
            </span>
            <span className="compare__score">
              <span className="compare__caption">After</span>{' '}
              <span className="compare__value">{diff.score.after}</span>
            </span>
            <span className="compare__change">Score {describeScoreChange(diff.score.change)}</span>
          </p>
          <table className="data-table compare-table">
            <caption className="sr-only">Issues by severity, before and after</caption>
            <thead>
              <tr>
                <th scope="col">Severity</th>
                <th scope="col" className="num">
                  Before
                </th>
                <th scope="col" className="num">
                  After
                </th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {diff.counts.map((c) => (
                <tr key={c.severity}>
                  <th scope="row">
                    <Severity level={c.severity} />
                  </th>
                  <td className="num">{c.before}</td>
                  <td className="num">{c.after}</td>
                  <td>{describeCountChange(c.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" aria-labelledby="history-heading">
        <h2 id="history-heading" className="section__title">
          History
        </h2>
        <table className="data-table history-table">
          <caption>Newest first. Counts leave out items to check by hand.</caption>
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col" className="num">
                Score
              </th>
              {SEVERITIES.map((s) => (
                <th key={s} scope="col" className="num wide-only">
                  {SEVERITY_LABEL[s]}
                </th>
              ))}
              <th scope="col" className="num narrow-only">
                Issues
              </th>
              <th scope="col">
                <span className="sr-only">Compare</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className={run.id === after.id ? 'is-current' : undefined}>
                <th scope="row">
                  <span className="wide-only">{formatTime(run.ranAt)}</span>
                  <span className="narrow-only">{formatShort(run.ranAt)}</span>
                </th>
                <td className="num">{run.score}</td>
                {SEVERITIES.map((s) => (
                  <td key={s} className="num wide-only">
                    {run.counts[s] ?? 0}
                  </td>
                ))}
                <td className="num narrow-only">{totalIssues(run)}</td>
                <td className="num">
                  <Link to={`/report/${run.id}`}>
                    Compare<span className="sr-only"> the run from {formatTime(run.ranAt)}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
