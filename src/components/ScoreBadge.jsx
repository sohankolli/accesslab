// components/ScoreBadge.jsx
import Icon from './Icon';
import Severity from './Severity';
import { SEVERITIES } from './severityLabels';

const R = 26;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** The change since the previous run in words, so it never relies on colour. */
function describeChange(score, previousScore) {
  if (previousScore == null) return 'First run';
  const diff = score - previousScore;
  if (diff === 0) return 'No change since last run';
  return `${diff > 0 ? 'Up' : 'Down'} ${Math.abs(diff)} since last run`;
}

/**
 * The audit score (0–100) as a ring and in text, the change since the previous
 * audit in words, and the issue counts per severity. Keeps the same size in
 * every state, so nothing shifts when results arrive.
 * @param {{score?: number, previousScore?: number|null,
 *          issues?: import('../engine/types.js').Issue[], auditing?: boolean}} props
 */
export default function ScoreBadge({ score, previousScore = null, issues = [], auditing = false }) {
  const pending = score == null;
  const scored = issues.filter((i) => !i.needsReview);
  const review = issues.length - scored.length;

  return (
    <div className="score">
      <div className="score__ring" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="64" height="64">
          <circle className="score__track" cx="32" cy="32" r={R} />
          {!pending && (
            <circle
              className="score__arc"
              cx="32"
              cy="32"
              r={R}
              strokeDasharray={`${(score / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              transform="rotate(-90 32 32)"
            />
          )}
        </svg>
        <span className="score__number tabular">{pending ? '–' : score}</span>
      </div>
      <div className="score__summary">
        <p className="score__label">
          {pending ? (
            auditing ? (
              'Auditing…'
            ) : (
              'Not audited yet'
            )
          ) : (
            <>
              Score <span className="tabular">{score}</span>
              <span className="score__max"> / 100</span>
            </>
          )}
        </p>
        <p className="score__change">
          {pending ? 'Results appear here' : describeChange(score, previousScore)}
        </p>
      </div>
      <ul className="severity-counts" aria-label="Issues by severity">
        {SEVERITIES.map((level) => (
          <li key={level} className={`count-chip count-chip--${level}`}>
            <Severity level={level} />{' '}
            <span className="tabular">{scored.filter((i) => i.severity === level).length}</span>
          </li>
        ))}
        {review > 0 && (
          <li className="count-chip count-chip--review">
            <Icon name="eye" />
            To review <span className="tabular">{review}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
