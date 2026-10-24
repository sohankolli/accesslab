// components/ScoreBadge.jsx

/** Describe the change since the previous run in words, so it never relies on colour. */
function describeChange(score, previousScore) {
  if (previousScore == null) return null;
  const diff = score - previousScore;
  if (diff === 0) return 'no change since last run';
  return `${diff > 0 ? '▲ up' : '▼ down'} ${Math.abs(diff)} since last run`;
}

/**
 * The audit score (0–100) and its change since the previous audit.
 * @param {{score?: number, previousScore?: number|null}} props
 */
export default function ScoreBadge({ score, previousScore = null }) {
  if (score == null) return null;
  const change = describeChange(score, previousScore);
  return (
    <span className="score-badge">
      <span className="score-badge__value">Score {score}</span>
      {change && <span className="score-badge__change"> ({change})</span>}
    </span>
  );
}
