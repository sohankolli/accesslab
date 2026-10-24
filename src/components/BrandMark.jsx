// components/BrandMark.jsx
/** The AccessLab mark: a figure inside a rounded square (decorative). */
export default function BrandMark({ size = 24 }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <g fill="none" stroke="var(--accent-contrast)" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="6.5" r="1.4" fill="var(--accent-contrast)" stroke="none" />
        <path d="M6.5 10h11M12 10v4.5M12 14.5l-3 4.5M12 14.5l3 4.5" />
      </g>
    </svg>
  );
}
