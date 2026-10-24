// features/simulate/Simulator.jsx
import { Link } from 'react-router';

export default function Simulator() {
  return (
    <div className="page page--narrow">
      <title>Simulate – AccessLab</title>
      <div className="page__header">
        <div>
          <h1 className="page__title">Simulate</h1>
          <p className="page__lead">Experience the page the way people with disabilities do.</p>
        </div>
      </div>
      <div className="card empty-state">
        <h2 className="empty-state__title">Coming in Milestone 3</h2>
        <p>
          Colour-vision and low-vision simulations, 200% text, the keyboard tab-order map and a
          screen-reader view of your page.
        </p>
        <Link to="/audit" className="btn">
          Back to the workbench
        </Link>
      </div>
    </div>
  );
}
