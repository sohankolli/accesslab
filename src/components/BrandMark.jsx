/** The AccessLab mark: a "tumbling E", the optotype of an eye chart (decorative). */
export default function BrandMark({ size = 26 }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <rect width="26" height="26" rx="5" fill="var(--ink)" />
      <path d="M7 6h12v3H10.5v2.5H17v3h-6.5V17H19v3H7z" fill="var(--chart)" />
    </svg>
  );
}
