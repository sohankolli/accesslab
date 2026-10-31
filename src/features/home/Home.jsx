import { useDispatch } from 'react-redux';
import { Link } from 'react-router';
import { sampleLoaded } from '../editor/editorSlice';
import './home.css';

const STEPS = [
  {
    title: 'Paste your page',
    text: 'Put HTML and CSS in the editor. It renders in a sandbox where its own scripts never run.',
  },
  {
    title: 'See what fails',
    text: 'Each problem is marked on the page, with who it affects and the rule it breaks.',
  },
  {
    title: 'Fix it and check again',
    text: 'Apply a suggested fix or edit the code. The score updates as you type.',
  },
];

/** The headline set like an eye chart: each row smaller than the one above. */
const CHART_ROWS = ['See', 'your page', 'the way', 'everyone else', 'sees it.'];

export default function Home() {
  const dispatch = useDispatch();
  return (
    <div className="home">
      <title>AccessLab – accessibility testing workbench</title>

      <section className="hero" aria-labelledby="home-heading">
        <h1 id="home-heading" className="chart-head">
          {CHART_ROWS.map((row, i) => (
            // The trailing space keeps the words apart in the heading's accessible name.
            <span key={row} className={`chart-head__row chart-head__row--${i + 1}`}>
              {row}{' '}
            </span>
          ))}
        </h1>
        <div className="pitch">
          <p className="pitch__lede">
            Paste any page. AccessLab shows what blocks people who use screen readers, keyboards or
            low vision, and how to fix each one.
          </p>
          <div className="pitch__actions">
            {/* Opens the workbench with the HTML editor focused and its text
                selected, so a paste replaces it (and undo brings it back). */}
            <Link to="/audit" state={{ paste: true }} className="btn btn--primary btn--lg">
              Check a page
            </Link>
            <Link to="/audit" className="btn btn--lg" onClick={() => dispatch(sampleLoaded())}>
              Try the sample café
            </Link>
          </div>
          <p className="pitch__fine">Runs entirely in your browser. Your code never leaves it.</p>
        </div>
      </section>

      <section className="steps" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="sr-only">
          How it works
        </h2>
        <ol className="steps__list">
          {STEPS.map((step, i) => (
            <li key={step.title} className="step">
              <span className="step__number" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="step__title">{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
