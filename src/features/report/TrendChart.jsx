// features/report/TrendChart.jsx
// A hand-drawn SVG line of scores, oldest to newest (no chart library). It is
// drawn in real pixels at the width it is given, so labels stay readable on
// phones. The drawing is decorative; the caption states the same facts in words.
import { useEffect, useRef, useState } from 'react';

const PAD = { top: 16, right: 16, bottom: 16, left: 36 };

/** @param {{runs: {id: string, score: number}[]}} props  newest first, as stored */
export default function TrendChart({ runs }) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const W = Math.max(width, 200);
  const H = W < 500 ? 150 : 200;
  const points = [...runs].reverse(); // oldest first, left to right
  const n = points.length;
  const x = (i) =>
    PAD.left +
    (n === 1 ? (W - PAD.left - PAD.right) / 2 : (i * (W - PAD.left - PAD.right)) / (n - 1));
  const y = (score) => PAD.top + ((100 - score) / 100) * (H - PAD.top - PAD.bottom);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const scores = points.map((p) => p.score);

  return (
    <figure className="trend">
      <div ref={boxRef}>
        <svg width={W} height={H} className="trend__chart" aria-hidden="true" focusable="false">
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line className="trend__grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="trend__axis" x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {n > 1 && <polyline className="trend__line" points={line} />}
          {points.map((p, i) => (
            <circle
              key={p.id}
              className={i === n - 1 ? 'trend__dot trend__dot--latest' : 'trend__dot'}
              cx={x(i)}
              cy={y(p.score)}
              r={i === n - 1 ? 5 : 3.5}
            />
          ))}
        </svg>
      </div>
      <figcaption className="trend__caption">
        Latest score <strong>{scores.at(-1)}</strong>. Best {Math.max(...scores)}, lowest{' '}
        {Math.min(...scores)}, over {n} {n === 1 ? 'check' : 'checks'}, oldest on the left.
      </figcaption>
    </figure>
  );
}
