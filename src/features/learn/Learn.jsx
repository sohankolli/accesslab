import { Link } from 'react-router';
import { listPacks } from '../../engine/rules';
import { RULE_GUIDES } from './ruleguides';
import './learn.css';

const PACK_DESCRIPTIONS = {
  'wcag-aa': 'Accessibility requirements for text, controls and page structure.',
  'best-practice': 'Additional checks that help make pages easier to navigate.',
};

export default function Learn() {
  const groups = listPacks();

  return (
    <div className="page page--narrow">
      <title>Learn – AccessLab</title>

      <header className="page__header">
        <div>
          <h1 className="page__title">Learn accessibility</h1>
          <p className="page__lead">
            Understand common accessibility issues, why they matter, and how to fix them.
          </p>
        </div>
      </header>

      {groups.map((group) => {
        const guides = group.ruleIds
          .map((id) => ({ id, guide: RULE_GUIDES[id] }))
          .filter(({ guide }) => Boolean(guide));

        return (
          <section className="section" key={group.id} aria-labelledby={`pack-${group.id}`}>
            <h2 id={`pack-${group.id}`} className="section__title">
              {group.title}
            </h2>
            <p className="learn-intro">
              {PACK_DESCRIPTIONS[group.id] ?? `${group.count} accessibility rules in this pack.`}
            </p>

            <ul className="learn-grid">
              {guides.map(({ id, guide }) => (
                <li key={id}>
                  <article className="learn-card">
                    <h3>{guide.title}</h3>
                    <p>{guide.summary}</p>
                    <Link to={`/learn/${id}`} className="btn">
                      Read guide
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="section" aria-labelledby="try-heading">
        <h2 id="try-heading" className="section__title">
          Try it yourself
        </h2>
        <p className="learn-intro">
          Audit your own HTML and CSS to find accessibility issues and experiment with fixes.
        </p>
        <Link to="/audit" className="btn btn--primary">
          Open the workbench
        </Link>
      </section>
    </div>
  );
}
