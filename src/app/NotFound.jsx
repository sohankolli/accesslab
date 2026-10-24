// app/NotFound.jsx
import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="page">
      <title>Page not found · AccessLab</title>
      <h1>Page not found</h1>
      <p>There is no page at this address. Try one of these instead:</p>
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/audit">Audit a page</Link>
        </li>
        <li>
          <Link to="/learn">Learn about the rules</Link>
        </li>
      </ul>
    </div>
  );
}
