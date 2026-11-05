import { useDispatch } from 'react-redux';
import { useNavigate, useParams, Link } from 'react-router';
import { learnExampleOpened } from '../editor/editorSlice';
import { RULE_GUIDES } from './ruleguides';
import './learn.css';

function getExampleHtml(ruleId, bad) {
  const pageExamples = {
    'html-lang': `<!doctype html>
<html>
<head><title>Example page</title></head>
<body><main><h1>Example page</h1></main></body>
</html>`,
    'page-title': `<!doctype html>
<html lang="en">
<head></head>
<body><main><h1>Example page</h1></main></body>
</html>`,
    'landmark-main': `<!doctype html>
<html lang="en">
<head><title>Example page</title></head>
<body>${bad}</body>
</html>`,
  };

  return pageExamples[ruleId] ?? bad;
}

export default function RuleDetail() {
  const { ruleId } = useParams();
  const guide = RULE_GUIDES[ruleId];
  const dispatch = useDispatch();
  const navigate = useNavigate();

  if (!guide) {
    return (
      <div className="page page--narrow">
        <title>Guide not found – AccessLab</title>
        <div className="empty-state">
          <h1 className="empty-state__title">Guide not found</h1>
          <p>We couldn't find a learning guide for that rule.</p>
          <Link to="/learn" className="btn btn--primary">
            Back to Learn
          </Link>
        </div>
      </div>
    );
  }

  function tryInWorkbench() {
    dispatch(
      learnExampleOpened({
        html: getExampleHtml(ruleId, guide.bad),
        css: '',
      }),
    );
    navigate('/audit');
  }

  return (
    <div className="page page--narrow">
      <title>{`${guide.title} – AccessLab`}</title>

      <header className="page__header">
        <div>
          <p className="learn-kicker">Accessibility rule guide</p>
          <h1 className="page__title">{guide.title}</h1>
          <p className="page__lead">{guide.summary}</p>
        </div>
      </header>

      <section className="section">
        <h2 className="section__title">Why this matters</h2>
        <p>{guide.why}</p>
      </section>

      <section className="section">
        <h2 className="section__title">How to fix it</h2>
        <div className="learn-prose">
          <p>{guide.fix}</p>
          <p>{guide.example}</p>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Example that needs fixing</h2>
        <pre className="learn-code">
          <code>{guide.bad}</code>
        </pre>
      </section>

      <section className="section">
        <h2 className="section__title">Improved example</h2>
        <pre className="learn-code">
          <code>{guide.good}</code>
        </pre>
      </section>

      <nav aria-label="Learning navigation" className="learn-nav">
        <Link to="/learn" className="btn">
          All guides
        </Link>
        <button type="button" className="btn btn--primary" onClick={tryInWorkbench}>
          Try it in the Workbench
        </button>
      </nav>
    </div>
  );
}
