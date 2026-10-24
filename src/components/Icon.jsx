// components/Icon.jsx
// A small hand-drawn icon set (inline SVG, no icon library). Icons are always
// decorative: the visible or visually hidden text next to them carries the meaning.

const PATHS = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20.5 14.1A8.5 8.5 0 1 1 9.9 3.5a6.6 6.6 0 0 0 10.6 10.6z" />,
  monitor: (
    <>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
      <path d="M8 21h8M12 16.5V21" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  tablet: (
    <>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8 12.5l2.8 2.8L16.5 9.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  sparkle: (
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
  ),
  trash: <path d="M3.5 6.5h17M9 6.5V4h6v2.5M6 6.5l1 14h10l1-14M10 10.5v6M14 10.5v6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  layers: <path d="M12 3l9.5 5L12 13 2.5 8zM2.5 12.5L12 17.5l9.5-5M2.5 16.5L12 21.5l9.5-5" />,
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2.5h6V4M8.5 10h7M8.5 14h7M8.5 18h4" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  // Severity: a different SHAPE for each level, so it never relies on colour.
  critical: (
    <>
      <path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8z" />
      <path d="M12 7.5v5.5M12 16.5v.5" />
    </>
  ),
  serious: (
    <>
      <path d="M10.3 3.9L1.9 18.2A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4.5M12 17v.5" />
    </>
  ),
  moderate: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.5v5.5M12 16.5v.5" />
    </>
  ),
  minor: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 16.5V11M12 7.5V7" />
    </>
  ),
};

/**
 * @param {{name: keyof typeof PATHS, size?: number, className?: string}} props
 */
export default function Icon({ name, size = 16, className = 'icon' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
