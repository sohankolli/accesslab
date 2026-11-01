import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="page page--narrow">
      <title>Page not found – AccessLab</title>
      <div className="card empty-state">
        <p className="empty-state__code" aria-hidden="true">
          404
        </p>
        <h1 className="empty-state__title">Page not found</h1>
        <p>There is no page at this address. Try one of these instead:</p>
        <div className="empty-state__actions">
          <Link to="/" className="btn">
            Home
          </Link>
          <Link to="/audit" className="btn btn--primary">
            Audit a page
          </Link>
          <Link to="/report" className="btn">
            Report
          </Link>
        </div>
      </div>
    </div>
  );
}
