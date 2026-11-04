import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router';
import { MANIFEST_URL, MODEL_BASE, NOT_REACHED } from '../../engine/ml/manifest';
import { downloadFeedback } from '../audit/feedback';
import './modelCard.css';

/**
 * A measured number for display; anything missing says so instead of guessing.
 * "not reached" marks a value that needs a threshold when no threshold reached
 * the target precision.
 */
const missing = (v) => (v === NOT_REACHED ? 'not reached' : 'not measured');
const num = (v, digits = 2) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : missing(v);
const pct = (v) =>
  typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : missing(v);
const ci = (pair, fmt = num) =>
  Array.isArray(pair) && pair[0] != null
    ? ` (95% interval ${fmt(pair[0])} to ${fmt(pair[1])})`
    : '';
const count = (v) =>
  typeof v === 'number' ? v.toLocaleString() : v === NOT_REACHED ? 'not reached' : '–';

const GATE_LABELS = {
  precision: 'Precision at the shipped threshold',
  beats_best_gbt: 'Beats the best gradient-boosting baseline',
  ece: 'Calibration error',
  size: 'Model file size',
  latency: 'Time for 2,000 elements in the Web Worker',
};

function gateValue(id, g) {
  if (g.value == null || g.value === NOT_REACHED) return missing(g.value);
  if (id === 'precision') return pct(g.value);
  if (id === 'beats_best_gbt') return `PR-AUC ${num(g.value, 3)} vs ${num(g.baseline, 3)}`;
  if (id === 'ece') return num(g.value, 3);
  if (id === 'size') return `${Math.round(g.value / 1024)} KB`;
  if (id === 'latency') return `${num(g.value, 1)} ms`;
  return String(g.value);
}

function GateTable({ caption, gate }) {
  return (
    <div className="table-wrap">
      <table className="card-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Condition</th>
            <th scope="col">Target</th>
            <th scope="col">Measured</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(gate ?? {}).map(([id, g]) => (
            <tr key={id}>
              <th scope="row">{GATE_LABELS[id] ?? id}</th>
              <td>{g.target}</td>
              <td>
                {gateValue(id, g)}
                {g.note && <span className="card-note">{g.note}</span>}
              </td>
              <td>{g.pass == null ? 'Not measured' : g.pass ? 'Met' : 'Not met'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Results for one group of test websites. Without a threshold the precision and
 * recall columns would describe an arbitrary cut-off, so they are left out.
 */
function Breakdown({ title, rows, field, hasThreshold }) {
  if (!rows?.length) return null;
  return (
    <div className="table-wrap">
      <table className="card-table">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{field === 'framework' ? 'Framework' : 'Kind of site'}</th>
            <th scope="col">Sites</th>
            <th scope="col">Elements</th>
            <th scope="col">Click-only</th>
            <th scope="col">PR-AUC</th>
            {hasThreshold && <th scope="col">Precision</th>}
            {hasThreshold && <th scope="col">Recall</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[field]}>
              <th scope="row">{r[field]}</th>
              <td>{count(r.sites)}</td>
              <td>{count(r.rows)}</td>
              <td>{count(r.positives)}</td>
              <td>{num(r.pr_auc, 3)}</td>
              {hasThreshold && <td>{pct(r.precision)}</td>}
              {hasThreshold && <td>{pct(r.recall)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** How far the automatic labels can be trusted: measured, or said to be not yet measured. */
function LabelQuality({ card }) {
  const probe = card.labelProbe;
  const hand = card.labelHandCheck;
  return (
    <>
      {hand ? (
        <>
          <p>
            Hand-check sheet of {count(hand.sampled)} random labels, filled in by an automated
            audit: {count(hand.judged)} judged, {count(hand.wrong)} wrong, {count(hand.unsure)}{' '}
            unsure. That is {pct(hand.errorRate)} of the judged labels wrong (95% interval{' '}
            {pct(hand.errorRateCi95?.[0])} to {pct(hand.errorRateCi95?.[1])}).
          </p>
          {hand.method && <p>{hand.method}</p>}
          {hand.reading && <p>{hand.reading}</p>}
        </>
      ) : (
        <p>
          The hand-check of 300 random labels has not been done yet, so the label error rate is not
          measured.
        </p>
      )}
      <LabelProbe probe={probe} />
    </>
  );
}

/** The automatic click test: a second opinion on the labels. */
function LabelProbe({ probe }) {
  if (!probe) return null;
  return (
    <p>
      {`An automatic second opinion clicked ${probe.tested} random labelled elements in the live pages: the label and the page's reaction disagreed for ${pct(probe.disagreementRate)} of them. That is an upper bound on label noise, since a click can also reach a handler on a parent. `}
      {probe.reading}
    </p>
  );
}

/** The model card: what the model was trained on, how it measured on unseen sites, and its limits. */
export default function ModelCard() {
  const [state, setState] = useState({ status: 'loading' });
  const dismissed = useSelector((s) => s.clickables?.dismissed ?? []);

  useEffect(() => {
    let live = true;
    fetch(MANIFEST_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((m) => live && setState({ status: 'done', m }))
      .catch((err) => live && setState({ status: 'failed', error: err.message }));
    return () => {
      live = false;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="page page--narrow">
        <title>Model card – AccessLab</title>
        <p role="status">Loading the model card…</p>
      </div>
    );
  }
  if (state.status === 'failed') {
    return (
      <div className="page page--narrow">
        <title>Model card – AccessLab</title>
        <h1 className="page__title">Model card</h1>
        <div className="notice" role="alert">
          <p>
            <strong>The model card could not be loaded</strong> ({state.error}). Model suggestions
            are unavailable; the rules work as before.
          </p>
        </div>
      </div>
    );
  }

  const { m } = state;
  const test = m.metrics?.test ?? {};
  const card = m.card ?? {};
  const splits = m.data?.splits ?? {};
  const hasThreshold = typeof m.threshold === 'number';

  return (
    <div className="page page--narrow model-card">
      <title>Model card – AccessLab</title>
      <header className="page__header">
        <div>
          <p className="eyebrow">Learn · Model card</p>
          <h1 className="page__title">Click-only controls model</h1>
          <p className="page__lead">
            Finds elements that a mouse can click but a keyboard cannot reach and a screen reader
            does not announce, such as a <code>&lt;div&gt;</code> with a click handler. Version{' '}
            {m.version}, trained {m.trainedAt?.slice(0, 10)}.
          </p>
        </div>
      </header>

      <section aria-labelledby="mc-status">
        <h2 id="mc-status">Status</h2>
        {card.summary?.length > 0 && (
          <ul>
            {card.summary.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <p>
          {m.defaultOn
            ? 'Every quality check below passed, so suggestions are on by default.'
            : 'Not every quality check below has passed, so suggestions are off by default. You can switch them on under the rule packs on the Workbench; treat them as hints.'}{' '}
          Suggestions are advisory: they never change the score, the history or the report.
        </p>
        <GateTable caption="Ship gate for the model in use, on test websites" gate={m.gate} />
        {m.shipped === 'fallback' && (
          <>
            <h3>Why a baseline is in use</h3>
            <p>
              The plan ships the graph network only if it passes the gate. It did not (see below),
              so, as the plan says, the best baseline ships through the same worker and interface.
              The graph network is kept for comparison and retraining.
            </p>
            <GateTable
              caption="Ship gate for the graph network, on the same test websites"
              gate={m.metrics?.graphNetwork?.gate}
            />
          </>
        )}
      </section>

      <section aria-labelledby="mc-how">
        <h2 id="mc-how">How it works</h2>
        <p>
          The preview runs with scripts off, so the click handlers that make these elements work
          never attach and the rules cannot see them. The model reads what is left: 92 cues per
          element (its tag, pointer cursor, inline event attributes, tabindex, background, rounded
          corners, size, text length, icons inside, and the words in its class and id), for the
          element and for its parent, children, siblings, grandparent and grandchildren. The model
          in use ({m.architecture}) turns those 552 numbers into a probability. It runs in a Web
          Worker in your browser; your code is never sent anywhere.
        </p>
        {hasThreshold ? (
          <p>
            An element is suggested when its probability is at least {num(m.threshold, 3)}. That
            threshold was chosen on calibration websites to keep precision at 90% or more, because a
            noisy assistant gets ignored.
          </p>
        ) : (
          <p>
            Threshold: not reached. A threshold is chosen on calibration websites to keep precision
            at 90% or more, because a noisy assistant gets ignored. No threshold reached that, so
            the model in use scores every element but suggests none.
          </p>
        )}
      </section>

      <section aria-labelledby="mc-data">
        <h2 id="mc-data">What it was trained on</h2>
        {m.data?.note && <p>{m.data.note}</p>}
        <p>
          {count(m.data?.rows)} elements from {count(m.data?.sites)} websites in{' '}
          {count(m.data?.sources)} sources; {count(m.data?.positives)} of them are click-only
          controls. Labels come from the browser itself: an element counts as clickable when Chrome
          reports a click, mousedown, pointerdown or keydown listener on it, or React reports an
          onClick prop. No page text, screenshots or personal data were stored.
        </p>
        <LabelQuality card={card} />
        <p>
          The data is split by website, so the model is always tested on sites it never saw:
          training {count(splits.train?.sites)} sites, calibration{' '}
          {count(splits.calibration?.sites)}, test {count(splits.test?.sites)}.
        </p>
      </section>

      <section aria-labelledby="mc-accuracy">
        <h2 id="mc-accuracy">How accurate it is on websites it never saw</h2>
        <p>Measured for the model in use: {test.model}.</p>
        <ul>
          {hasThreshold ? (
            <>
              <li>
                Precision {pct(test.precision)}
                {ci(test.precision_ci95, pct)}: of {count(test.flagged)} suggestions on the test
                sites, {count(test.tp)} were real click-only controls.
              </li>
              <li>
                Recall {pct(test.recall)}: it found {count(test.tp)} of{' '}
                {count((test.tp ?? 0) + (test.fn ?? 0))} click-only controls. The rest are missed,
                so no suggestions does not mean none exist.
              </li>
            </>
          ) : (
            <li>
              Precision and recall: not reached. They are measured at the threshold, and no
              threshold reached 90% precision. The test websites hold{' '}
              {count(splits.test?.positives)} click-only controls in {count(splits.test?.rows)}{' '}
              elements.
            </li>
          )}
          <li>
            Area under the precision-recall curve {num(test.pr_auc, 3)}
            {ci(test.pr_auc_ci95, (v) => num(v, 3))}.
          </li>
          <li>
            Calibration error {num(test.ece, 3)}: how far the probabilities are from the observed
            rates. With so few click-only controls, a low value is easy to reach and says little.
          </li>
        </ul>
        <div className="table-wrap">
          <table className="card-table">
            <caption>Compared on the same test websites</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">PR-AUC</th>
                <th scope="col">Precision</th>
                <th scope="col">Recall</th>
              </tr>
            </thead>
            <tbody>
              {(m.metrics?.comparisons ?? []).map((c) => (
                <tr key={c.model}>
                  <th scope="row">{c.model}</th>
                  <td>{num(c.pr_auc, 3)}</td>
                  <td>{pct(c.precision)}</td>
                  <td>{pct(c.recall)}</td>
                </tr>
              ))}
              {(m.metrics?.ablations ?? []).map((a) => (
                <tr key={a.model}>
                  <th scope="row">{a.model}</th>
                  <td>{num(a.pr_auc, 3)}</td>
                  <td>–</td>
                  <td>–</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {m.metrics?.seeds && (
          <p>
            The graph network is not stable on this much data: trained three times with different
            random seeds, its PR-AUC on the test websites was{' '}
            {m.metrics.seeds.pr_auc.map((v) => num(v, 3)).join(', ')} (mean{' '}
            {num(m.metrics.seeds.mean, 3)}).
          </p>
        )}
        {m.metrics?.heldOutSources && (
          <p>
            A stricter test, with whole sources held out (no site from the same collection in
            training): PR-AUC {num(m.metrics.heldOutSources.sign_pr_auc, 3)} for this network and{' '}
            {num(m.metrics.heldOutSources.gbt_neighbourhood_pr_auc, 3)} for gradient boosting, on{' '}
            {count(m.metrics.heldOutSources.test_rows)} elements, of which{' '}
            {count(m.metrics.heldOutSources.test_positives)} are click-only controls.
          </p>
        )}
        <figure className="reliability">
          <img
            src={`${MODEL_BASE}clickables-v1-reliability.svg`}
            alt="Reliability diagram: predicted probability against the observed rate of click-only controls on the test websites."
            width="420"
            height="420"
          />
          <figcaption>
            Reliability on the test websites. Points near the diagonal mean the percentages can be
            taken at face value, but the test websites hold only {count(splits.test?.positives)}{' '}
            click-only controls, so each point rests on very few of them.
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="mc-fails">
        <h2 id="mc-fails">Where it fails</h2>
        <Breakdown
          title="By framework"
          rows={m.metrics?.byFramework}
          field="framework"
          hasThreshold={hasThreshold}
        />
        <Breakdown
          title="By kind of site"
          rows={m.metrics?.byCategory}
          field="category"
          hasThreshold={hasThreshold}
        />
        {card.failurePatterns?.length > 0 && (
          <>
            <h3>Patterns in the errors</h3>
            <ul>
              {card.failurePatterns.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="mc-trust">
        <h2 id="mc-trust">When not to trust it</h2>
        <ul>
          {(card.limitations ?? []).map((t) => (
            <li key={t}>{t}</li>
          ))}
          <li>
            The labels have known noise: an element clicked through a handler on one of its
            ancestors can be labelled as not clickable. Pages that handle clicks with one listener
            on the whole document (event delegation) were left out of training for this reason.
          </li>
          <li>
            It sees only the HTML and CSS you pasted. A page built by scripts must be pasted as its
            rendered HTML.
          </li>
        </ul>
      </section>

      <section aria-labelledby="mc-feedback">
        <h2 id="mc-feedback">Your feedback</h2>
        <p>
          &ldquo;Not an issue&rdquo; on a suggestion hides it and keeps a record in this browser:
          the element&rsquo;s 552 numbers and selector, no page text. Export the records to help
          train the next version.
        </p>
        <p>
          {dismissed.length} {dismissed.length === 1 ? 'record' : 'records'} in this browser.{' '}
          {dismissed.length > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => downloadFeedback(dismissed, m.version)}
            >
              Export as JSON
            </button>
          )}
        </p>
        <p>
          <Link to="/learn">All guides</Link> · <Link to="/audit">Open the workbench</Link>
        </p>
      </section>
    </div>
  );
}
