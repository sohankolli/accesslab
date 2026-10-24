// features/home/Home.jsx
import { Link } from 'react-router';

export default function Home() {
  return (
    <div className="page">
      <title>AccessLab</title>
      <h1>AccessLab</h1>
      <p>
        An in-browser accessibility testing workbench. Paste a page's HTML and CSS, see which
        barriers it contains and why, fix them live, and watch the score improve.
      </p>
      <p>
        <Link to="/audit">Open the audit workbench</Link>
      </p>
    </div>
  );
}
