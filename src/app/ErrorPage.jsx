import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

/** Shown instead of AppLayout when rendering a route throws. */
export default function ErrorPage() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : (error?.message ?? 'Unknown error');

  return (
    <>
      <title>Something went wrong – AccessLab</title>
      <SiteHeader />
      <main id="main">
        <div className="page page--narrow">
          <div className="card empty-state">
            <h1 className="empty-state__title">Something went wrong</h1>
            <p>AccessLab hit an unexpected error while showing this page.</p>
            <p>
              <code>{detail}</code>
            </p>
            <div className="empty-state__actions">
              <Link to="/" className="btn btn--primary">
                Go to the home page
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
