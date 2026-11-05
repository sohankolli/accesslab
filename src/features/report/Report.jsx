import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router';
import { historyCleared } from './historySlice';
import { compareRuns, describeCountChange, describeScoreChange } from './compareRuns';
import TrendChart from './TrendChart';
import Severity from '../../components/Severity';
import { SEVERITIES, SEVERITY_LABEL } from '../../components/severityLabels';
import './report.css';
import { downloadRunJSON, downloadRunCSV } from './reportExport';
import PrintableReport from './PrintableReport';
import { groupByPage, pageKeyOf } from './pages';

const formatTime = (ms) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
const formatShort = (ms) => new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(ms);
const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

/** The default "before": the run just before `afterId` (the next newer one if it is the oldest). */
function runBefore(runs, afterId) {
  const i = runs.findIndex((r) => r.id === afterId);
  return (runs[i + 1] ?? runs[i - 1] ?? runs[i])?.id;
}

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

  // Everything below shows one page's runs, so a check is never compared with a
  // different page. The default page is the one checked most recently, or the
  // page of the run named in /report/:runId.
  const groups = useMemo(() => groupByPage(runs), [runs]);
  const linked = runs.find((r) => r.id === runId);
  const [pageKey, setPageKey] = useState(() => (linked ? pageKeyOf(linked) : groups[0]?.key));
  const group = groups.find((g) => g.key === pageKey) ?? groups[0];
  const pageRuns = group?.runs ?? [];

  // Default comparison: the page's latest run (or the linked one) as "after",
  // and the run just before it as "before".
  const [afterId, setAfterId] = useState(() => linked?.id ?? pageRuns[0]?.id);
  const [beforeId, setBeforeId] = useState(() => runBefore(pageRuns, afterId));
  const after = pageRuns.find((r) => r.id === afterId) ?? pageRuns[0];
  const before = pageRuns.find((r) => r.id === beforeId) ?? pageRuns[1] ?? pageRuns[0];

  // Read out by screen readers when the page changes (the select itself is quiet about it).
  const [announcement, setAnnouncement] = useState('');

  /** Show another page: its latest run against the one before it. */
  function showPage(key, message = '') {
    const next = groups.find((g) => g.key === key);
    if (!next) return;
    setPageKey(key);
    setAfterId(next.runs[0].id);
    setBeforeId(runBefore(next.runs, next.runs[0].id));
    setAnnouncement(`${message}Showing ${plural(next.runs.length, 'run')} of ${next.name}.`);
  }

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
            Your last {plural(runs.length, 'check')} of {plural(groups.length, 'page')}, saved in
            this browser.
          </p>
        </div>

        <div className="report__actions">
          <button type="button" className="btn" onClick={() => downloadRunJSON(after)}>
            Download JSON
          </button>

          <button type="button" className="btn" onClick={() => downloadRunCSV(after)}>
            Download CSV
          </button>

          <button type="button" className="btn" onClick={() => window.print()}>
            Print / Save PDF
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm('Delete all saved checks?')) {
                dispatch(historyCleared());
              }
            }}
          >
            Clear history
          </button>
        </div>
      </div>

      {saveNotice}

      <div className="report__page">
        <label className="field">
          <span className="field__label">Page</span>
          <select value={group.key} onChange={(e) => showPage(e.target.value)}>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.name} ({plural(g.runs.length, 'run')})
              </option>
            ))}
          </select>
        </label>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>

      <section className="section" aria-labelledby="trend-heading">
        <h2 id="trend-heading" className="section__title">
          Score trend
        </h2>
        <TrendChart runs={pageRuns} />
      </section>

      <section className="section" aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="section__title">
          Before and after
        </h2>
        {pageRuns.length < 2 ? (
          <p className="section__note">Check this page again to compare.</p>
        ) : (
          <>
            <div className="compare-pickers">
              <label className="field">
                <span className="field__label">Before</span>
                <select value={before.id} onChange={(e) => setBeforeId(e.target.value)}>
                  {pageRuns.map((run) => (
                    <option key={run.id} value={run.id}>
                      {runLabel(run)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">After</span>
                <select value={after.id} onChange={(e) => setAfterId(e.target.value)}>
                  {pageRuns.map((run) => (
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
                <span className="compare__change">
                  Score {describeScoreChange(diff.score.change)}
                </span>
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
          </>
        )}
      </section>

      <section className="section" aria-labelledby="history-heading">
        <h2 id="history-heading" className="section__title">
          History
        </h2>
        <table className="data-table history-table">
          <caption>
            Checks of {group.name}, newest first. Counts leave out items to check by hand.
          </caption>
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
            {pageRuns.map((run) => (
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

      {/* Printable PDF report */}
      <PrintableReport run={after} beforeRun={pageRuns.length > 1 ? before : null} />
    </div>
  );
}
