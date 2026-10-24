// components/Severity.jsx
import Icon from './Icon';
import { SEVERITY_LABEL } from './severityLabels';

/** Severity as icon + word + colour, never colour alone. */
export default function Severity({ level, children }) {
  return (
    <span className={`severity severity--${level}`}>
      <Icon name={level} />
      {children ?? SEVERITY_LABEL[level]}
    </span>
  );
}
