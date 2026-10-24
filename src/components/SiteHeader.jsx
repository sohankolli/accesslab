// components/SiteHeader.jsx
import { Link, NavLink } from 'react-router';
import { useSettings } from '../context/SettingsContext';
import BrandMark from './BrandMark';
import Segmented from './Segmented';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/audit', label: 'Workbench' },
  { to: '/simulate', label: 'Simulate' },
  { to: '/report', label: 'Report' },
  { to: '/learn', label: 'Learn' },
];

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function SiteHeader() {
  const { theme, setTheme } = useSettings();
  return (
    <header className="site-header">
      <Link to="/" className="site-header__brand">
        <BrandMark />
        AccessLab
      </Link>
      {/* NavLink sets aria-current="page" on the active link, so screen readers
          announce it as the current page; CSS styles the same attribute. */}
      <nav className="site-nav" aria-label="Main">
        <ul className="site-nav__links">
          {LINKS.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink to={to} end={end}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Segmented
        legend="Colour theme"
        name="theme"
        value={theme}
        onChange={setTheme}
        options={THEMES}
        variant="ink"
      />
    </header>
  );
}
