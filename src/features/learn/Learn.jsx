// features/learn/Learn.jsx
import { Link } from 'react-router';

export default function Learn() {
  return (
    <div className="page page--narrow">
      <title>Learn – AccessLab</title>
      <div className="page__header">
        <div>
          <h1 className="page__title">Learn</h1>
          <p className="page__lead">Why each rule matters, who it affects and how to fix it.</p>
        </div>
      </div>
      <div className="card empty-state">
        <h2 className="empty-state__title">Rule guides are coming in Milestone 4</h2>
        <p>
          Until then, every issue in the workbench links its WCAG success criterion and says how to
          fix it.
        </p>
        <Link to="/audit" className="btn btn--primary">
          Open the workbench
        </Link>
      </div>
    </div>
  );
}
