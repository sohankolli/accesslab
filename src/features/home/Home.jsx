import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router';
import { sampleLoaded } from '../editor/editorSlice';
import { makeBookmarkletUrl } from '../editor/bookmarklet';
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
  const bookmarkletUrl = makeBookmarkletUrl(window.location.origin);
  const bookmarkletLink = useRef(null);

  useEffect(() => {
    bookmarkletLink.current?.setAttribute('href', bookmarkletUrl);
  }, [bookmarkletUrl]);

  return (
    <div className="home">
      <title>AccessLab – accessibility testing workbench</title>

      <section className="hero" aria-labelledby="home-heading">
        <h1 id="home-heading" className="chart-head">
          {/* The trailing space keeps the words apart in the heading's accessible name. */}
          {CHART_ROWS.map((row, i) => (
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

      <section className="bookmarklet" aria-labelledby="bookmarklet-heading">
        <div className="bookmarklet__content">
          <h2 id="bookmarklet-heading">Check any live page</h2>

          <p>
            Want to check a website without copying its code? Add AccessLab to your bookmarks bar.
          </p>

          <a
            ref={bookmarkletLink}
            className="btn btn--primary btn--lg bookmarklet__link"
            draggable="true"
            href={bookmarkletUrl}
            onClick={(event) => {
              event.preventDefault();
              window.location.href = bookmarkletUrl;
            }}
          >
            Check with AccessLab
          </a>

          <ol>
            <li>Drag this link to your browser's bookmarks bar.</li>
            <li>Visit any website and click the saved bookmark to check it.</li>
          </ol>

          <p className="bookmarklet__note">
            Pages behind login are checked as they appear in your browser. Some stylesheets from
            other websites may not be accessible.
          </p>

          <details className="bookmarklet__source">
            <summary>View bookmarklet source</summary>
            <pre>
              <code>{bookmarkletUrl.slice('javascript:'.length)}</code>
            </pre>
          </details>
        </div>
      </section>
    </div>
  );
}
