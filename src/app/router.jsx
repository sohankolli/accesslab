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
const RuleDetail = lazy(() => import('../features/learn/RuleDetail'));
const ModelCard = lazy(() => import('../features/learn/ModelCard'));
const NotFound = lazy(() => import('./NotFound'));

const page = (Page) => (
  <Suspense fallback={<p role="status">Loading…</p>}>
    <Page />
  </Suspense>
);

// Learn has a list page (/learn) and one guide page per rule (/learn/:ruleId).
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
      { path: 'learn/model-card', element: page(ModelCard) },
      { path: 'learn/:ruleId', element: page(RuleDetail) },
      { path: '*', element: page(NotFound) },
    ],
  },
]);
