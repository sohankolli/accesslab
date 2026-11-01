import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

export default function AppLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const previousPathname = useRef(pathname);

  // In a single-page app the browser does not move focus on navigation, so
  // screen-reader users would not notice the page changed. Move it ourselves.
  // Not on the first load, though: there the skip link must stay the first
  // thing Tab reaches (Section 7). Comparing with the previous pathname also
  // survives StrictMode running this effect twice on mount.
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    mainRef.current?.focus();
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}
