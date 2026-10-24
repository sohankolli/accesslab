// app/router.jsx
import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import AppLayout from './AppLayout';
import ErrorPage from './ErrorPage';

// Each page becomes its own JavaScript chunk, loaded on first visit.
const Home = lazy(() => import('../features/home/Home'));
const Workbench = lazy(() => import('../features/audit/Workbench'));
const Simulator = lazy(() => import('../features/simulate/Simulator'));
const Report = lazy(() => import('../features/report/Report'));
const Learn = lazy(() => import('../features/learn/Learn'));
const NotFound = lazy(() => import('./NotFound'));

const page = (Page) => (
  <Suspense fallback={<p role="status">Loading…</p>}>
    <Page />
  </Suspense>
);

// learn/:ruleId (RuleDetail) is added with the Learn pages in a later milestone;
// until then such paths fall through to NotFound.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: page(Home) },
      { path: 'audit', element: page(Workbench) },
      { path: 'simulate', element: page(Simulator) },
      { path: 'report', element: page(Report) },
      { path: 'report/:runId', element: page(Report) },
      { path: 'learn', element: page(Learn) },
      { path: '*', element: page(NotFound) },
    ],
  },
]);
