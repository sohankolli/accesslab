// features/audit/ScoreReading.jsx
import SeverityShape from '../../components/SeverityShape';
import { SEVERITIES } from '../../components/severityLabels';
import { acuityFor, snellenLineFor, SNELLEN_LINES, inTheWay, describeDelta } from './acuity';

/**
 * A decorative Snellen chart with the line the score reaches underlined and
 * labelled. Hidden from screen readers: the "Reads at 20/30" sentence says it.
 * The letters are drawn by CSS (content: attr(data-letters)), not as text:
 * the rows below the reached line are deliberately faint, which is fine for
 * decoration, but as real text they would fail a contrast check.
 */
function Snellen({ line }) {
  return (
    <div className="snellen" aria-hidden="true">
      {SNELLEN_LINES.map((l, i) => (
        <span
          key={l.acuity}
          className={
            line == null ? undefined : i === line ? 'is-here' : i > line ? 'is-dim' : undefined
          }
          style={{ fontSize: l.size }}
          data-acuity={i === line ? l.acuity : undefined}
          data-letters={l.letters}
        />
      ))}
    </div>
  );
}

/**
 * The reading at the top of the findings pane: the score, its eye-chart acuity,
 * the change since the last check, and the issues counted by severity.
 * Keeps the same size in every state, so nothing shifts when results arrive.
 * @param {{score?: number, previousScore?: number|null,
 *          issues?: import('../../engine/types.js').Issue[], auditing?: boolean,
 *          failed?: boolean, headingRef?: import('react').Ref<HTMLHeadingElement>}} props
 *   headingRef goes on the pane's heading, which receives focus after "Apply fix".
 */
export default function ScoreReading({
  score,
  previousScore = null,
  issues = [],
  auditing = false,
  failed = false,
  headingRef,
}) {
  const pending = score == null;
  const scored = issues.filter((i) => !i.needsReview);
  const review = issues.length - scored.length;

  return (
    <div className="reading-block">
      <div className="reading">
        <div>
          {/* tabIndex -1: "Apply fix" removes its own row after the re-audit, so
              focus moves here instead of being lost. */}
          <h2 id="issues-heading" className="sr-only" ref={headingRef} tabIndex={-1}>
            Findings
          </h2>
          {pending ? (
            <p className="score">
              <span aria-hidden="true">–</span>
              <span className="sr-only">No score yet</span>
            </p>
          ) : (
            <p className="score">
              <span className="sr-only">Score {score} out of 100</span>
              <span aria-hidden="true">
                {score}
                <small>/ 100</small>
              </span>
            </p>
          )}
          <p className="acuity">
            {pending ? (
              failed ? (
                'The check failed'
              ) : auditing ? (
                'Checking the page…'
              ) : (
                'Not checked yet'
              )
            ) : (
              <>
                Reads at <strong>{acuityFor(score)}</strong>. {inTheWay(scored.length)}
              </>
            )}
          </p>
          <p className="delta">
            {pending ? 'Results appear here' : describeDelta(score, previousScore)}
          </p>
        </div>
        <Snellen line={pending ? null : snellenLineFor(score)} />
      </div>
      <ul className="tally" aria-label="Findings by severity">
        {SEVERITIES.map((level) => (
          <li key={level} className={`tally__item tally__item--${level}`}>
            <SeverityShape level={level} />
            <b>{scored.filter((i) => i.severity === level).length}</b> {level}
          </li>
        ))}
        {review > 0 && (
          <li className="tally__item">
            <b>{review}</b> to check by hand
          </li>
        )}
      </ul>
    </div>
  );
}
