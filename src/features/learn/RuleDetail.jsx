
import { Link, useParams } from 'react-router';
import { RULE_GUIDES } from './ruleguides';

export default function RuleDetail() {
  const { ruleId } = useParams();
  const guide = RULE_GUIDES[ruleId];

  if (!guide) {
    return (
      <main className="page page--narrow">
        <title>Guide not found - AccessLab</title>
        <h1>Guide not found</h1>
        <p>We couldn't find a learning guide for that rule.</p>
        <Link to="/learn" className="btn btn--primary">
          Back to Learn
        </Link>
      </main>
    );
  }

  return (
    <main className="page page--narrow">
      <title>{guide.title} - AccessLab</title>

      <header className="page__header">
        <div>
          <p className="page__lead">Accessibility rule guide</p>
          <h1 className="page__title">{guide.title}</h1>
          <p>{guide.summary}</p>
        </div>
      </header>

      <section className="card">
        <h2>Why this matters</h2>
        <p>{guide.why}</p>
      </section>

      <section className="card">
        <h2>How to fix it</h2>
        <p>{guide.fix}</p>
        <p>{guide.example}</p>
      </section>

      <section className="card">
        <h2>Example that needs fixing</h2>
        <pre><code>{guide.bad}</code></pre>
      </section>

      <section className="card">
        <h2>Improved example</h2>
        <pre><code>{guide.good}</code></pre>
      </section>

      <nav aria-label="Learning navigation">
        <Link to="/learn" className="btn">All guides</Link>
        {' '}
        <Link to="/audit" className="btn btn--primary">
          Try it in the Workbench
        </Link>
      </nav>
    </main>
  );
}

