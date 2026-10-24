// features/report/Report.jsx
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router';
import { historyCleared } from './historySlice';
import { SEVERITIES, compareRuns, describeCountChange, describeScoreChange } from './compareRuns';

const LABEL = { critical: 'Critical', serious: 'Serious', moderate: 'Moderate', minor: 'Minor' };
const formatTime = (ms) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(ms);

export default function Report() {
  const dispatch = useDispatch();
  const runs = useSelector((state) => state.history.runs); // newest first
  const { runId } = useParams();

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
      <div className="page">
        <title>Report · AccessLab</title>
        <h1>Report</h1>
        <p>
          No audits yet. <Link to="/audit">Open the workbench</Link> and every audit will be
          recorded here.
        </p>
      </div>
    );
  }

  const diff = compareRuns(before, after);
  const runLabel = (run) => `${formatTime(run.ranAt)}: score ${run.score}`;

  return (
    <div className="page page--wide">
      <title>Report · AccessLab</title>
      <h1>Report</h1>

      <section aria-labelledby="compare-heading">
        <h2 id="compare-heading">Before and after</h2>
        <div className="compare-pickers">
          <label>
            Before
            <select value={before.id} onChange={(e) => setBeforeId(e.target.value)}>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {runLabel(run)}
                </option>
              ))}
            </select>
          </label>
          <label>
            After
            <select value={after.id} onChange={(e) => setAfterId(e.target.value)}>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {runLabel(run)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="compare-score">
          Score {diff.score.before} → {diff.score.after} ({describeScoreChange(diff.score.change)})
        </p>
        <ul className="compare-counts">
          {diff.counts.map((c) => (
            <li key={c.severity}>
              {LABEL[c.severity]}: {c.before} → {c.after} ({describeCountChange(c.change)})
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading">History</h2>
        <table className="history-table">
          <caption>
            Last {runs.length} audits, newest first. Counts exclude items that need manual review.
          </caption>
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Score</th>
              {SEVERITIES.map((s) => (
                <th key={s} scope="col">
                  {LABEL[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <th scope="row">{formatTime(run.ranAt)}</th>
                <td>{run.score}</td>
                {SEVERITIES.map((s) => (
                  <td key={s}>{run.counts[s] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Delete all saved audit runs?')) dispatch(historyCleared());
          }}
        >
          Clear history
        </button>
      </section>
    </div>
  );
}
