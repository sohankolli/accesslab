// app/ErrorPage.jsx
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
      <title>Something went wrong · AccessLab</title>
      <SiteHeader />
      <main id="main" className="page">
        <h1>Something went wrong</h1>
        <p>AccessLab hit an unexpected error while showing this page.</p>
        <p>
          <code>{detail}</code>
        </p>
        <p>
          <Link to="/">Go to the home page</Link> or reload to try again.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
