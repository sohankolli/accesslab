import SeverityShape from './SeverityShape';
import { SEVERITY_LABEL } from './severityLabels';

/** Severity as shape + word + colour, never colour alone. */
export default function Severity({ level, children }) {
  return (
    <span className={`severity severity--${level}`}>
      <SeverityShape level={level} />
      <span className="severity__word">{children ?? SEVERITY_LABEL[level]}</span>
    </span>
  );
}
