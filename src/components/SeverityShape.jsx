// A different filled shape for each severity (octagon, triangle, diamond, circle),
// so severity never relies on colour alone. Always decorative: a word goes next to it.

const SHAPES = {
  critical: <path d="M4.1 0h5.8L14 4.1v5.8L9.9 14H4.1L0 9.9V4.1z" />,
  serious: <path d="M7 0l7 13H0z" />,
  moderate: <path d="M7 0l7 7-7 7-7-7z" />,
  minor: <circle cx="7" cy="7" r="6" />,
};

/** @param {{level: 'critical'|'serious'|'moderate'|'minor', size?: number}} props */
export default function SeverityShape({ level, size = 14 }) {
  return (
    <svg
      className={`shape shape--${level}`}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[level]}
    </svg>
  );
}
