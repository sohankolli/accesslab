// components/SiteHeader.jsx
import { Link, NavLink } from 'react-router';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/audit', label: 'Audit' },
  { to: '/simulate', label: 'Simulate' },
  { to: '/report', label: 'Report' },
  { to: '/learn', label: 'Learn' },
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link to="/" className="site-header__brand">
        AccessLab
      </Link>
      {/* NavLink sets aria-current="page" on the active link, so screen readers
          announce it as the current page; CSS styles the same attribute. */}
      <nav aria-label="Main">
        <ul className="site-header__links">
          {LINKS.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink to={to} end={end}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
