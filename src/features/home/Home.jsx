// features/home/Home.jsx
import { useDispatch } from 'react-redux';
import { Link } from 'react-router';
import { listPacks, rulesFor } from '../../engine/rules';
import { sampleLoaded } from '../editor/editorSlice';
import Icon from '../../components/Icon';
import Severity from '../../components/Severity';
import './home.css';

const STEPS = [
  {
    icon: 'clipboard',
    title: 'Paste your page',
    text: 'Drop in HTML and CSS. It renders in a sandbox where its own scripts never run.',
  },
  {
    icon: 'eye',
    title: 'See every barrier',
    text: 'Eleven WCAG 2.2 rules run live. Each issue is outlined on the preview and explained.',
  },
  {
    icon: 'sparkle',
    title: 'Fix it and prove it',
    text: 'Apply suggested fixes in one click, watch the score rise, and compare runs.',
  },
];

export default function Home() {
  const dispatch = useDispatch();
  return (
    <div className="page home">
      <title>AccessLab · Accessibility testing workbench</title>

      <section className="hero">
        <p className="eyebrow">Accessibility testing workbench</p>
        <h1 className="hero__title">
          Find and fix accessibility barriers while you write the page.
        </h1>
        <p className="hero__lead">
          Paste HTML and CSS, get a scored list of WCAG 2.2 issues with the reason and the fix for
          each, and re-audit live as you edit. Everything runs in your browser.
        </p>
        <div className="hero__actions">
          {/* A link (it navigates) that also loads the sample page into the editor. */}
          <Link
            to="/audit"
            className="btn btn--primary btn--lg"
            onClick={() => dispatch(sampleLoaded())}
          >
            Open the workbench
            <Icon name="arrowRight" />
          </Link>
          <Link to="/learn" className="btn btn--lg">
            How the rules work
          </Link>
        </div>
      </section>

      <section className="home__section" aria-labelledby="how-heading">
        <h2 id="how-heading" className="section-title">
          How it works
        </h2>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="step">
              <span className="step__number tabular" aria-hidden="true">
                {i + 1}
              </span>
              <Icon name={step.icon} size={20} className="icon step__icon" />
              <h3 className="step__title">{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home__section" aria-labelledby="checks-heading">
        <h2 id="checks-heading" className="section-title">
          What it checks
        </h2>
        <div className="packs">
          {listPacks().map((pack) => (
            <div key={pack.id} className="card pack-card">
              <h3 className="card__title">
                {pack.title}{' '}
                <span className="pack-card__count">
                  {pack.count} {pack.count === 1 ? 'rule' : 'rules'}
                </span>
              </h3>
              <ul className="rule-list">
                {rulesFor([pack.id]).map((rule) => (
                  <li key={rule.id}>
                    <Severity level={rule.severity} /> <code>{rule.id}</code>{' '}
                    <span className="rule-list__wcag">{rule.wcag}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="privacy">
        <Icon name="lock" />
        No server and no sign-up: your code, history and settings stay in this browser.
      </p>
    </div>
  );
}
