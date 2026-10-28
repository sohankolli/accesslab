
import { Link } from 'react-router';
import { RULE_GUIDES } from './ruleguides';

const GROUPS = [
  {
    title: 'WCAG 2.2 A/AA',
    description: 'Accessibility requirements for text, controls and page structure.',
    ids: [
      'img-alt',
      'form-label',
      'button-name',
      'link-name',
      'color-contrast',
      'html-lang',
      'page-title',
    ],
  },
  {
    title: 'Best practices',
    description: 'Additional checks that help make pages easier to navigate.',
    ids: [
      'heading-order',
      'tabindex-positive',
      'duplicate-id',
      'landmark-main',
    ],
  },
];

export default function Learn() {
  return (
    <main className="page page--narrow">
      <title>Learn - AccessLab</title>

      <header className="page__header">
        <div>
          <h1 className="page__title">Learn accessibility</h1>
          <p className="page__lead">
            Understand common accessibility issues, why they matter,
            and how to fix them.
          </p>
        </div>
      </header>

      {GROUPS.map((group) => (
        <section key={group.title} className="learn-group">
          <h2>{group.title}</h2>
          <p>{group.description}</p>

          <div className="learn-grid">
            {group.ids.map((id) => {
              const guide = RULE_GUIDES[id];

              return (
                <article className="card learn-card" key={id}>
                  <h3>{guide.title}</h3>
                  <p>{guide.summary}</p>
                  <Link
                    to={`/learn/${id}`}
                    className="btn btn--primary"
                  >
                    Read guide
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className="card">
        <h2>Try it yourself</h2>
        <p>
          Audit your own HTML and CSS to find accessibility issues
          and experiment with fixes.
        </p>
        <Link to="/audit" className="btn btn--primary">
          Open the workbench
        </Link>
      </section>
    </main>
  );
}
